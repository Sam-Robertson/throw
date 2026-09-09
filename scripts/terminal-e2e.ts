/**
 * End-to-end check of the Terminal payment path against a simulated WisePOS E.
 *
 *   npm run terminal:e2e
 *
 * Exercises the real settle logic in src/lib/terminal.ts rather than a
 * reimplementation, so the on-reader tip reconciliation is genuinely verified.
 *
 * Self-contained and self-cleaning: it creates its own test-mode Terminal
 * location and simulated reader if none exist, and removes the order, payment
 * and mirrored Payment row it created before exiting. It refuses to run against
 * anything but a Stripe test key.
 */
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { settleTerminalPayment, TERMINAL_METHOD } from "@/lib/terminal";
import { recalculateOrderTotals } from "@/lib/pos";

const TIP_CENTS = 1000;
const ITEM_CENTS = 5000;
const ITEM_NAME = "__terminal-e2e test item";

async function ensureSimulatedReader() {
  const existing = await stripe.terminal.readers.list({ limit: 100 });
  const simulated = existing.data.find((r) => r.device_type === "simulated_wisepos_e");
  if (simulated) return simulated;

  const location = await stripe.terminal.locations.create({
    display_name: "terminal-e2e (test)",
    address: {
      line1: "308 E 300 S",
      city: "Provo",
      state: "UT",
      country: "US",
      postal_code: "84606",
    },
  });
  return stripe.terminal.readers.create({
    registration_code: "simulated-wpe",
    location: location.id,
    label: "terminal-e2e simulated reader",
  });
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test")) {
    throw new Error("Refusing to run outside Stripe test mode");
  }

  const reader = await ensureSimulatedReader();
  console.log(`reader ${reader.id} (${reader.device_type})`);

  const location = await prisma.location.findFirstOrThrow({ where: { isActive: true } });
  const staff = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  const order = await prisma.posOrder.create({
    data: { locationId: location.id, staffId: staff.id, status: "OPEN" },
  });

  let failed = 0;
  try {
    await prisma.posOrderItem.create({
      data: {
        orderId: order.id,
        itemType: "RETAIL",
        name: ITEM_NAME,
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
      // Mirrors the route: tip basis is the amount this reader is charging.
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
    const finalPayment = await prisma.posPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });

    const expectedTotal = ITEM_CENTS + TIP_CENTS;
    const checks: [string, unknown, unknown][] = [
      ["payment status", finalPayment.status, "SUCCEEDED"],
      ["payment amount", finalPayment.amountCents, expectedTotal],
      ["order tipCents", finalOrder.tipCents, TIP_CENTS],
      ["order totalCents", finalOrder.totalCents, expectedTotal],
      ["order status", finalOrder.status, "COMPLETED"],
    ];
    for (const [label, actual, expected] of checks) {
      const ok = actual === expected;
      if (!ok) failed++;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`,
      );
    }

    // Settling twice must not double-count the tip.
    const again = await settleTerminalPayment(payment.id, settled);
    const idempotent = again.tipCents === TIP_CENTS && again.totalCents === expectedTotal;
    if (!idempotent) failed++;
    console.log(
      `${idempotent ? "PASS" : "FAIL"}  idempotent re-settle: tip ${again.tipCents}, total ${again.totalCents}`,
    );
  } finally {
    // Never leave test rows behind — this runs against the real database.
    await prisma.payment
      .deleteMany({ where: { stripePaymentIntentId: `pos_${order.id}` } })
      .catch(() => {});
    await prisma.posPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } }).catch(() => {});
    console.log("cleaned up test order");
  }

  console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
