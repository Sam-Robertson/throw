import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripeForLocation } from "@/lib/stripe";
import { findStripeCustomerId } from "@/lib/stripeCustomers";
import { checkPermission } from "@/lib/permissions";
import { checkOrderPayable, formatMoney, remainingBalanceCents } from "@/lib/pos";

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
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const block = await checkOrderPayable(id);
  if (block) {
    return NextResponse.json({ error: block.error, message: block.message }, { status: block.status });
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

  // The sale is charged into the studio's own Stripe account. The browser
  // confirms the card with that account's publishable key, which is sent back
  // with the client secret so the POS loads the matching Stripe.js.
  const account = await stripeForLocation(order.locationId);
  if (!account.publishableKey) {
    return NextResponse.json(
      {
        error:
          "Typed-in card payments aren't set up for this studio yet (no Stripe publishable key configured). Use the card reader.",
      },
      { status: 503 },
    );
  }

  // Attach the customer only if they already exist in this account; a POS
  // sale never creates a Stripe Customer.
  const stripeCustomerId = order.customerId
    ? await findStripeCustomerId(account, order.customerId)
    : null;

  const paymentIntent = await account.client.paymentIntents.create({
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
    {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      publishableKey: account.publishableKey,
    },
    { status: 201 },
  );
}
