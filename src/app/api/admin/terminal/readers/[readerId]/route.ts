import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";

/** Unregisters a reader from the Stripe account. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ readerId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { readerId } = await params;
  try {
    await stripe.terminal.readers.del(readerId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not remove that reader.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
