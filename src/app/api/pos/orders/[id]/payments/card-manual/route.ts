import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPermission } from "@/lib/permissions";
import { formatMoney, remainingBalanceCents } from "@/lib/pos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { payments: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { amountCents?: number } | null;
  if (!body?.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "amountCents is required and must be positive" }, { status: 400 });
  }

  const remaining = remainingBalanceCents(order, order.payments);
  if (body.amountCents > remaining) {
    return NextResponse.json(
      { error: `amountCents cannot exceed the remaining balance of ${formatMoney(remaining)}` },
      { status: 400 },
    );
  }

  let stripeCustomerId: string | undefined;
  if (order.customerId) {
    const customer = await prisma.user.findUnique({
      where: { id: order.customerId },
      select: { stripeCustomerId: true },
    });
    stripeCustomerId = customer?.stripeCustomerId ?? undefined;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: body.amountCents,
    currency: "usd",
    metadata: { posOrderId: id, type: "pos" },
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
  });

  const payment = await prisma.posPayment.create({
    data: {
      orderId: id,
      method: "CARD_MANUAL",
      amountCents: body.amountCents,
      status: "PENDING",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return NextResponse.json(
    { clientSecret: paymentIntent.client_secret, paymentId: payment.id },
    { status: 201 },
  );
}
