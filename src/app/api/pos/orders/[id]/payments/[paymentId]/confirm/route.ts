import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPermission } from "@/lib/permissions";
import { maybeCompletePosOrder } from "@/lib/pos";

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

  if (payment.status === "SUCCEEDED") {
    // Idempotent no-op — the webhook likely already settled this.
    const order = await prisma.posOrder.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    return NextResponse.json({ order });
  }

  if (!payment.stripePaymentIntentId) {
    return NextResponse.json({ error: "This payment has no associated Stripe PaymentIntent" }, { status: 400 });
  }

  const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);

  if (intent.status === "succeeded") {
    const { count } = await prisma.posPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "SUCCEEDED" },
    });

    const order = count > 0
      ? await maybeCompletePosOrder(id)
      : await prisma.posOrder.findUnique({ where: { id }, include: { items: true, payments: true } });

    return NextResponse.json({ order });
  }

  await prisma.posPayment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED" },
  });

  const message = intent.last_payment_error?.message ?? `Payment status: ${intent.status}`;
  return NextResponse.json({ error: message }, { status: 402 });
}
