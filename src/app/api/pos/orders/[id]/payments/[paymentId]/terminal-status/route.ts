import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { TerminalError, getTerminalProgress } from "@/lib/terminal";

/**
 * Polled by the POS while the customer is at the reader.
 *
 * Returns { state: 'in_progress' | 'succeeded' | 'failed' }. Settling happens
 * here as well as in the webhook — whichever lands first wins — so the POS works
 * in development without `stripe listen` running.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, paymentId } = await params;

  const payment = await prisma.posPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.orderId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status === "SUCCEEDED") {
    const order = await prisma.posOrder.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    return NextResponse.json({ state: "succeeded", order });
  }

  if (payment.status === "FAILED") {
    return NextResponse.json({ state: "failed", message: "Payment failed." });
  }

  if (!payment.stripePaymentIntentId || !payment.externalRef) {
    return NextResponse.json(
      { error: "This payment is not a reader payment" },
      { status: 400 },
    );
  }

  try {
    const progress = await getTerminalProgress(
      paymentId,
      payment.externalRef,
      payment.stripePaymentIntentId,
    );
    return NextResponse.json(progress);
  } catch (err) {
    if (err instanceof TerminalError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
