import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripeForLocation } from "@/lib/stripe";

/**
 * Unregisters a reader from its studio's Stripe account. `?locationId=` says
 * which studio (and so which account) the reader belongs to.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ readerId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { readerId } = await params;
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    const account = await stripeForLocation(locationId);
    await account.client.terminal.readers.del(readerId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not remove that reader.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
