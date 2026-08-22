import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";

export interface OrderTotalsInput {
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
}

export function calculateOrderTotals(
  items: OrderTotalsInput[],
  tipCents = 0,
): OrderTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);

  // TODO: Utah charges sales tax on retail goods — wire up real tax calculation here
  // once rates/nexus rules are defined. Flat 0% for now.
  const taxCents = 0;

  const totalCents = subtotalCents - discountCents + taxCents + tipCents;

  return { subtotalCents, discountCents, taxCents, tipCents, totalCents };
}

/**
 * Recomputes an order's totals from its current line items (never trusting
 * client-supplied totals) and persists them. Shared by every route that
 * mutates items or the order's tip, so totals are always derived, not stored
 * ad hoc.
 */
export async function recalculateOrderTotals(orderId: string, tipCentsOverride?: number) {
  const order = await prisma.posOrder.findUniqueOrThrow({ where: { id: orderId } });
  const items = await prisma.posOrderItem.findMany({ where: { orderId } });

  const totals = calculateOrderTotals(
    items.map((item) => ({
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      discountCents: item.discountCents,
    })),
    tipCentsOverride ?? order.tipCents,
  );

  return prisma.posOrder.update({
    where: { id: orderId },
    data: totals,
    include: { items: true, payments: true },
  });
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Balance still owed on an order, given its current SUCCEEDED payments. */
export function remainingBalanceCents(
  order: { totalCents: number },
  payments: { status: string; amountCents: number }[],
): number {
  const succeeded = payments
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(0, order.totalCents - succeeded);
}

const GIFT_CARD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // excludes 0, O, 1, I, L

export function generateGiftCardCode(): string {
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += GIFT_CARD_ALPHABET[Math.floor(Math.random() * GIFT_CARD_ALPHABET.length)];
  }
  return code;
}

/** Retries on the (astronomically rare) chance of a code collision with an existing gift card. */
async function createGiftCardWithUniqueCode(data: {
  initialCents: number;
  balanceCents: number;
  purchasedById: string | null;
  locationId: string;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.giftCard.create({ data: { ...data, code: generateGiftCardCode() } });
    } catch (err) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueViolation || attempt === 4) throw err;
    }
  }
  throw new Error("Failed to generate a unique gift card code");
}

/**
 * Marks an order COMPLETED and runs one-time completion side effects (mirrored
 * Payment record, gift card issuance, stock decrement, pos/order.completed
 * event) the first time SUCCEEDED payments cover totalCents. The atomic
 * `updateMany` guard (status must still be OPEN) ensures this only runs once
 * even if two payment routes race to settle the balance concurrently.
 */
export async function maybeCompletePosOrder(orderId: string) {
  const order = await prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });

  if (order.status !== "OPEN") return order;

  const owed = remainingBalanceCents(order, order.payments);
  if (owed > 0) return order;

  const { count } = await prisma.posOrder.updateMany({
    where: { id: orderId, status: "OPEN" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  if (count === 0) {
    // Lost the race to a concurrent completion — return the current state.
    return prisma.posOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
  }

  if (order.customerId) {
    await prisma.payment
      .create({
        data: {
          userId: order.customerId,
          locationId: order.locationId,
          stripePaymentIntentId: `pos_${order.id}`,
          amountInCents: order.totalCents,
          status: "SUCCEEDED",
          type: "OTHER",
        },
      })
      .catch(() => {
        // Idempotency: ignore if the mirrored Payment record already exists
      });
  }
  // If customerId is null (walk-in), walk-in POS revenue is reported from
  // PosOrder directly rather than mirrored into Payment.

  for (const item of order.items.filter((i) => i.itemType === "GIFT_CARD")) {
    for (let i = 0; i < item.quantity; i++) {
      await createGiftCardWithUniqueCode({
        initialCents: item.unitPriceCents,
        balanceCents: item.unitPriceCents,
        purchasedById: order.customerId,
        locationId: order.locationId,
      });
    }
  }

  for (const item of order.items.filter((i) => i.itemType === "RETAIL" && i.refId)) {
    await prisma.retailProduct
      .update({
        where: { id: item.refId! },
        data: { inventory: { decrement: item.quantity } },
      })
      .catch(() => {
        // Non-fatal: don't block order completion on a stock update failure
      });
  }

  await inngest.send({ name: "pos/order.completed", data: { orderId: order.id } });

  return prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
}

/**
 * Net cash that should be in the drawer: opening float plus every CASH
 * SUCCEEDED payment's amountCents (already net of change — change is what
 * left the drawer, so it's never added back or subtracted again here).
 */
export async function computeDrawerExpectedCash(
  locationId: string,
  openedAt: Date,
  openingFloatCents: number,
): Promise<{ expectedCashCents: number; cashPaymentCount: number }> {
  const cashPayments = await prisma.posPayment.findMany({
    where: {
      method: "CASH",
      status: "SUCCEEDED",
      createdAt: { gte: openedAt },
      order: { locationId, status: "COMPLETED" },
    },
    select: { amountCents: true },
  });

  const cashInCents = cashPayments.reduce((sum, p) => sum + p.amountCents, 0);

  return {
    expectedCashCents: openingFloatCents + cashInCents,
    cashPaymentCount: cashPayments.length,
  };
}
