/**
 * End-to-end check of the Terminal payment path against a simulated WisePOS E.
 *
 *   npm run terminal:e2e
 *
 * Exercises the real settle logic in src/lib/terminal.ts and the real order
 * completion in src/lib/pos.ts rather than a reimplementation, so the on-reader
 * tip reconciliation and drop-in booking creation are genuinely verified.
 *
 * The order carries a retail line and a DROP_IN line for a test customer, and
 * the script checks that completing it:
 *   - settles the payment and the on-reader tip (idempotently), and
 *   - books the customer into the session (Booking.posOrderItemId set).
 * It also checks that a drop-in order with no customer is refused payment.
 *
 * Self-contained and self-cleaning: it creates its own test-mode Terminal
 * location and simulated reader if none exist, its own customer, session type
 * and session, and removes every row it created before exiting. It refuses to
 * run against anything but a Stripe test key. It prints the database it's
 * connected to — point DATABASE_URL at a scratch database, not production.
 */
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { settleTerminalPayment, TERMINAL_METHOD } from "@/lib/terminal";
import { checkOrderPayable, repriceOrder } from "@/lib/pos";
import { getApplicableWaiver } from "@/lib/waivers";
import { taxCodeForPosItem } from "@/config/taxCodes";

const TIP_CENTS = 1000;
const ITEM_CENTS = 5000;
const DROP_IN_CENTS = 3500;
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

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${String(actual)}${ok ? "" : ` (expected ${String(expected)})`}`);
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test")) {
    throw new Error("Refusing to run outside Stripe test mode");
  }

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  console.log(`database ${db}`);

  const reader = await ensureSimulatedReader();
  console.log(`reader ${reader.id} (${reader.device_type})`);

  const location = await prisma.location.findFirstOrThrow({ where: { isActive: true } });
  const staff = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  const stamp = Date.now();
  const customer = await prisma.user.create({
    data: { email: `terminal-e2e+${stamp}@example.invalid`, name: "Terminal E2E Customer" },
  });
  const sessionType = await prisma.sessionType.create({
    data: {
      name: "__terminal-e2e drop-in",
      slug: `terminal-e2e-${stamp}`,
      durationMinutes: 60,
      capacity: 10,
      dropInPriceCents: DROP_IN_CENTS,
      locationId: location.id,
    },
  });
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const studioSession = await prisma.studioSession.create({
    data: {
      sessionTypeId: sessionType.id,
      locationId: location.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      capacity: 10,
    },
  });

  const order = await prisma.posOrder.create({
    data: { locationId: location.id, staffId: staff.id, status: "OPEN" },
  });

  try {
    await prisma.posOrderItem.create({
      data: {
        orderId: order.id,
        itemType: "RETAIL",
        name: ITEM_NAME,
        quantity: 1,
        unitPriceCents: ITEM_CENTS,
        totalCents: ITEM_CENTS,
        taxCode: taxCodeForPosItem("RETAIL"),
      },
    });
    const dropInItem = await prisma.posOrderItem.create({
      data: {
        orderId: order.id,
        itemType: "DROP_IN",
        refId: sessionType.id,
        name: sessionType.name,
        quantity: 1,
        unitPriceCents: DROP_IN_CENTS,
        totalCents: DROP_IN_CENTS,
        taxCode: taxCodeForPosItem("DROP_IN"),
        metadata: { studioSessionId: studioSession.id, startsAt: startsAt.toISOString() },
      },
    });

    // A drop-in with no customer must not be payable.
    const blocked = await checkOrderPayable(order.id);
    check("drop-in without customer is refused", blocked?.error, "CUSTOMER_REQUIRED");

    await prisma.posOrder.update({ where: { id: order.id }, data: { customerId: customer.id } });

    // Everyone needs a signed waiver, POS drop-ins included.
    const waiver = await getApplicableWaiver(location.id);
    if (waiver) {
      const unsigned = await checkOrderPayable(order.id);
      check("drop-in with unsigned waiver is refused", unsigned?.error, "WAIVER_REQUIRED");
      await prisma.waiverSignature.create({
        data: {
          userId: customer.id,
          waiverVersionId: waiver.id,
          signedAt: new Date(),
          ipAddress: "terminal-e2e",
          typedName: customer.name,
        },
      });
    } else {
      console.log("no active waiver anywhere; skipping the waiver check");
    }
    check("payable once a customer is attached and has signed", await checkOrderPayable(order.id), null);

    const { order: priced, taxWarning } = await repriceOrder(order.id);
    console.log(
      `order #${priced.orderNumber} subtotal ${priced.subtotalCents} tax ${priced.taxCents} total ${priced.totalCents}` +
        (taxWarning ? ` (tax warning: ${taxWarning})` : ""),
    );

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

    const expectedTotal = priced.totalCents + TIP_CENTS;
    check("payment status", finalPayment.status, "SUCCEEDED");
    check("payment amount", finalPayment.amountCents, expectedTotal);
    check("order tipCents", finalOrder.tipCents, TIP_CENTS);
    check("order totalCents", finalOrder.totalCents, expectedTotal);
    check("order status", finalOrder.status, "COMPLETED");

    const booking = await prisma.booking.findUnique({ where: { posOrderItemId: dropInItem.id } });
    check("drop-in booking created", booking !== null, true);
    check("booking status", booking?.status, "CONFIRMED");
    check("booking source", booking?.source, "DROP_IN");
    check("booking customer", booking?.userId, customer.id);
    check("booking session", booking?.studioSessionId, studioSession.id);
    check("booking amountPaidCents", booking?.amountPaidCents, DROP_IN_CENTS);

    // Settling twice must not double-count the tip or book twice.
    const again = await settleTerminalPayment(payment.id, settled);
    check("idempotent re-settle tip", again.tipCents, TIP_CENTS);
    check("idempotent re-settle total", again.totalCents, expectedTotal);
    check(
      "still exactly one booking",
      await prisma.booking.count({ where: { studioSessionId: studioSession.id } }),
      1,
    );
  } finally {
    // Never leave test rows behind.
    await prisma.booking.deleteMany({ where: { studioSessionId: studioSession.id } }).catch(() => {});
    await prisma.payment
      .deleteMany({ where: { stripePaymentIntentId: `pos_${order.id}` } })
      .catch(() => {});
    await prisma.posPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } }).catch(() => {});
    await prisma.studioSession.delete({ where: { id: studioSession.id } }).catch(() => {});
    await prisma.sessionType.delete({ where: { id: sessionType.id } }).catch(() => {});
    await prisma.waiverSignature.deleteMany({ where: { userId: customer.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: customer.id } }).catch(() => {});
    console.log("cleaned up test order, session, session type, waiver signature and customer");
  }

  console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
