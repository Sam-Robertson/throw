import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  disableOnReaderTipping,
  enableOnReaderTipping,
  getTippingSetup,
} from "@/lib/terminal";

/**
 * Whether the card readers show a tip screen (a Stripe Terminal account
 * setting), and a switch for it. Admin only, like pairing readers.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json(await getTippingSetup());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the tipping setup from Stripe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Body: `{ enabled: boolean }`. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  }

  try {
    const setup = body.enabled ? await enableOnReaderTipping() : await disableOnReaderTipping();
    return NextResponse.json(setup);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update the tipping setup in Stripe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
