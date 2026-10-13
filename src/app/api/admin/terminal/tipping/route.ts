import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripeForLocation } from "@/lib/stripe";
import {
  disableOnReaderTipping,
  enableOnReaderTipping,
  getTippingSetup,
} from "@/lib/terminal";

/**
 * Whether the card readers show a tip screen (a Stripe Terminal account
 * setting), and a switch for it. Each studio's Stripe account has its own, so
 * both calls take the studio: `?locationId=` on GET, `locationId` in the POST
 * body. Admin only, like pairing readers.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });

  try {
    return NextResponse.json(await getTippingSetup(await stripeForLocation(locationId)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the tipping setup from Stripe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Body: `{ locationId: string, enabled: boolean }`. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    locationId?: unknown;
    enabled?: unknown;
  } | null;
  if (typeof body?.locationId !== "string" || !body.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  }

  try {
    const account = await stripeForLocation(body.locationId);
    const setup = body.enabled
      ? await enableOnReaderTipping(account)
      : await disableOnReaderTipping(account);
    return NextResponse.json(setup);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update the tipping setup in Stripe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
