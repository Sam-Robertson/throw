import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { TerminalError, listReadersForLocation } from "@/lib/terminal";

/** Readers registered to a studio, with their Stripe Terminal location. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({ readers: await listReadersForLocation(locationId) });
  } catch (err) {
    if (err instanceof TerminalError) {
      return NextResponse.json({ error: err.message, readers: [] }, { status: err.status });
    }
    throw err;
  }
}

/**
 * Registers a reader to a studio using the pairing code shown on the device.
 *
 * On a BBPOS WisePOS E: swipe in from the left edge → Settings, enter the admin
 * PIN (0-7-1-3-9 by default), then Generate pairing code. The code looks like
 * three words, e.g. "puppies-plug-could". In test mode the special code
 * "simulated-wpe" registers a simulated WisePOS E instead, which is what the
 * development flow uses.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    registrationCode?: string;
    label?: string;
  } | null;

  if (!body?.locationId || !body.registrationCode) {
    return NextResponse.json(
      { error: "locationId and registrationCode are required" },
      { status: 400 },
    );
  }

  const location = await prisma.location.findUnique({ where: { id: body.locationId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  if (!location.stripeTerminalLocationId) {
    return NextResponse.json(
      { error: "Link this studio to a reader location first." },
      { status: 409 },
    );
  }

  try {
    const reader = await stripe.terminal.readers.create({
      registration_code: body.registrationCode.trim(),
      location: location.stripeTerminalLocationId,
      ...(body.label?.trim() ? { label: body.label.trim() } : {}),
    });
    return NextResponse.json({ reader }, { status: 201 });
  } catch (err) {
    // A wrong or expired pairing code is the overwhelmingly common failure and
    // Stripe's message for it is already clear, so surface it as-is.
    const message =
      err instanceof Error ? err.message : "Could not register that reader.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
