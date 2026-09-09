import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Links a studio to a Stripe Terminal Location, creating one if needed.
 *
 * Readers are registered against a Stripe Terminal Location, so every studio
 * that takes card payments needs one before a reader can be paired.
 * Admin-only: this changes Stripe-side configuration, not day-to-day POS use.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  } | null;
  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({ where: { id: body.locationId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  if (location.stripeTerminalLocationId) {
    // Already linked — verify it still exists Stripe-side rather than assuming.
    const existing = await stripe.terminal.locations
      .retrieve(location.stripeTerminalLocationId)
      .catch(() => null);
    if (existing && !("deleted" in existing && existing.deleted)) {
      return NextResponse.json({ location, terminalLocationId: existing.id });
    }
  }

  // Stripe needs a structured address, but Location.address is a single free
  // text field, so the caller supplies the parts. Falling back to the stored
  // address for line1 keeps the common case one click.
  const line1 = body.line1?.trim() || location.address?.trim();
  const { city, state, postalCode } = body;
  if (!line1 || !city || !state || !postalCode) {
    return NextResponse.json(
      {
        error:
          "Stripe needs a full street address for a reader location: line 1, city, state and ZIP.",
        needsAddress: true,
        suggestedLine1: location.address ?? "",
      },
      { status: 400 },
    );
  }

  const created = await stripe.terminal.locations.create({
    display_name: location.name,
    address: { line1, city, state, country: "US", postal_code: postalCode },
    metadata: { locationId: location.id },
  });

  const updated = await prisma.location.update({
    where: { id: location.id },
    data: { stripeTerminalLocationId: created.id },
  });

  return NextResponse.json({ location: updated, terminalLocationId: created.id }, { status: 201 });
}
