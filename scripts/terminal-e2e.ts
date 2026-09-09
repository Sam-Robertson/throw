/**
 * End-to-end check of the Terminal payment path against a simulated WisePOS E.
 *
 * Exercises the real settle logic (src/lib/terminal.ts), not a reimplementation,
 * so the on-reader tip reconciliation is genuinely verified. Test mode only.
 *
 *   npx tsx scripts/terminal-e2e.ts   (or via ts-node, see package.json)
 */
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { settleTerminalPayment, TERMINAL_METHOD } from "@/lib/terminal";
import { recalculateOrderTotals } from "@/lib/pos";

const TIP_CENTS = 1000;
const ITEM_CENTS = 5000;

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test")) {
    throw new Error("Refusing to run outside Stripe test mode");
  }

  const location = await prisma.location.findFirstOrThrow({
    where: { stripeTerminalLocationId: { not: null } },
  });
  const staff = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const readers = await stripe.terminal.readers.list({
    location: location.stripeTerminalLocationId!,
    limit: 1,
  });
  const reader = readers.data[0];
  if (!reader) throw new Error("No reader registered to that location");
  console.log(`reader ${reader.id} (${reader.device_type}) @ ${location.name}`);

  const order = await prisma.posOrder.create({
    data: { locationId: location.id, staffId: staff.id, status: "OPEN" },
  });
  await prisma.posOrderItem.create({
    data: {
      orderId: order.id,
      itemType: "RETAIL",
      name: "E2E test mug",
      quantity: 1,
      unitPriceCents: ITEM_CENTS,
      totalCents: ITEM_CENTS,
    },
  });
  const priced = await recalculateOrderTotals(order.id);
  console.log(`order #${priced.orderNumber} total ${priced.totalCents} tip ${priced.tipCents}`);

  const intent = await stripe.paymentIntents.create({
    amount: priced.totalCents,
    currency: "usd",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    metadata: { posOrderId: order.id, type: "pos" },
  });
  const payment = await prisma.posPayment.create({
    data: {
      orderId: order.id,
      method: TERMINAL_METHOD,
      amountCents: priced.totalCents,
      status: "PENDING",
      stripePaymentIntentId: intent.id,
      externalRef: reader.id,
    },
  });

  await stripe.terminal.readers.processPaymentIntent(reader.id, {
    payment_intent: intent.id,
    process_config: { tipping: { amount_eligible: priced.totalCents } },
  });
  console.log("sent to reader; simulating a tap with a $10.00 tip…");

  await stripe.testHelpers.terminal.readers.presentPaymentMethod(reader.id, {
    amount_tip: TIP_CENTS,
  });

  const settled = await stripe.paymentIntents.retrieve(intent.id);
  console.log(
    `intent ${settled.status} amount=${settled.amount} received=${settled.amount_received} tip=${settled.amount_details?.tip?.amount ?? 0}`,
  );

  const finalOrder = await settleTerminalPayment(payment.id, settled);
  const finalPayment = await prisma.posPayment.findUniqueOrThrow({ where: { id: payment.id } });

  const expectedTotal = ITEM_CENTS + TIP_CENTS;
  const checks: [string, unknown, unknown][] = [
    ["payment status", finalPayment.status, "SUCCEEDED"],
    ["payment amount", finalPayment.amountCents, expectedTotal],
    ["order tipCents", finalOrder.tipCents, TIP_CENTS],
    ["order totalCents", finalOrder.totalCents, expectedTotal],
    ["order status", finalOrder.status, "COMPLETED"],
  ];

  let failed = 0;
  for (const [label, actual, expected] of checks) {
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
  }

  // Settling twice must not double-count the tip.
  const again = await settleTerminalPayment(payment.id, settled);
  const idempotent = again.tipCents === TIP_CENTS && again.totalCents === expectedTotal;
  console.log(`${idempotent ? "PASS" : "FAIL"}  idempotent re-settle: tip ${again.tipCents}, total ${again.totalCents}`);
  if (!idempotent) failed++;

  console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
