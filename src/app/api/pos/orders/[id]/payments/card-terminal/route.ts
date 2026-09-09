import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPermission } from "@/lib/permissions";
import { formatMoney, remainingBalanceCents } from "@/lib/pos";
import {
  TERMINAL_METHOD,
  TIP_PERCENTAGES,
  TerminalError,
  requireTerminalLocation,
  retrieveReader,
} from "@/lib/terminal";

/**
 * Starts a card payment on a Stripe Terminal reader (BBPOS WisePOS E).
 *
 * Creates a card_present PaymentIntent and hands it to the reader, which then
 * prompts the customer to tap/insert and — because on-reader tipping is enabled
 * — to choose a tip. Returns immediately; the client polls ./terminal-status.
 *
 * Note this cannot reuse the card-manual route: that one creates an automatic-
 * payment-methods PaymentIntent, which processPaymentIntent rejects.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    amountCents?: number;
    readerId?: string;
  } | null;

  if (!body?.readerId) {
    return NextResponse.json({ error: "readerId is required" }, { status: 400 });
  }
  if (!body.amountCents || body.amountCents <= 0) {
    return NextResponse.json(
      { error: "amountCents is required and must be positive" },
      { status: 400 },
    );
  }

  const remaining = remainingBalanceCents(order, order.payments);
  if (body.amountCents > remaining) {
    return NextResponse.json(
      { error: `amountCents cannot exceed the remaining balance of ${formatMoney(remaining)}` },
      { status: 400 },
    );
  }

  // Reject a reader that belongs to a different studio than the order.
  let terminalLocationId: string;
  try {
    terminalLocationId = (await requireTerminalLocation(order.locationId))
      .stripeTerminalLocationId;
  } catch (err) {
    if (err instanceof TerminalError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const reader = await retrieveReader(body.readerId);
  if (!reader || reader.location !== terminalLocationId) {
    return NextResponse.json(
      { error: "That reader is not registered to this studio." },
      { status: 400 },
    );
  }
  if (reader.action?.status === "in_progress") {
    return NextResponse.json(
      {
        error: "That reader is already taking a payment. Cancel it on the reader, or try again.",
        readerBusy: true,
      },
      { status: 409 },
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

  // capture_method stays automatic so payment_intent.succeeded actually fires —
  // manual capture would park the intent at requires_capture and the existing
  // POS webhook would never settle it.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: body.amountCents,
    currency: "usd",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    metadata: { posOrderId: id, type: "pos" },
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
  });

  const payment = await prisma.posPayment.create({
    data: {
      orderId: id,
      method: TERMINAL_METHOD,
      amountCents: body.amountCents,
      status: "PENDING",
      stripePaymentIntentId: paymentIntent.id,
      externalRef: body.readerId,
    },
  });

  try {
    await stripe.terminal.readers.processPaymentIntent(body.readerId, {
      payment_intent: paymentIntent.id,
      process_config: {
        tipping: {
          // Tip options are based on the amount THIS reader is charging, not the
          // whole bill. On a split payment the whole-bill basis would offer a
          // full-bill tip on every leg, and settleTerminalPayment adds each one
          // to order.tipCents — so the customer would be tipped twice over.
          amount_eligible: body.amountCents,
        },
      },
    });
  } catch (err) {
    // Never leave a PENDING payment behind for an action that never started.
    await prisma.posPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
    const message =
      err instanceof Error ? err.message : "Could not start the payment on that reader.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json(
    { paymentId: payment.id, readerId: body.readerId, tipPercentages: TIP_PERCENTAGES },
    { status: 201 },
  );
}
