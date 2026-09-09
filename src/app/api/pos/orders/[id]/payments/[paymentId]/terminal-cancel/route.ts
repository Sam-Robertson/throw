import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPermission } from "@/lib/permissions";
import { failTerminalPayment } from "@/lib/terminal";

/**
 * Cancels an in-flight reader payment — the "Cancel" button staff press while
 * the customer is still at the reader, and the escape hatch when a reader is
 * stuck on a stale action.
 *
 * Cancels the reader action first so the device stops prompting, then the
 * PaymentIntent, then marks the PosPayment FAILED. Each step tolerates having
 * already happened, so this is safe to press twice.
 */
export async function POST(
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

  // Already paid — cancelling now would be wrong; report the settled state.
  if (payment.status === "SUCCEEDED") {
    const order = await prisma.posOrder.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    return NextResponse.json({ state: "succeeded", order });
  }

  if (payment.externalRef) {
    await stripe.terminal.readers.cancelAction(payment.externalRef).catch(() => {
      // No action in progress, or the reader is offline — nothing to stop.
    });
  }
  if (payment.stripePaymentIntentId) {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId).catch(() => {
      // Already cancelled or already succeeded; the status route reconciles.
    });
  }

  await failTerminalPayment(paymentId);

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  return NextResponse.json({ state: "cancelled", order });
}
