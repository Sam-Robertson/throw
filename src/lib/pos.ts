import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendInngestEvent } from "@/lib/inngest";
import { calculatePosTax, recordTaxTransaction } from "@/lib/stripeTax";
import { parseFiringMetadata } from "@/config/firingPrices";
import { findUnsignedWaiver } from "@/lib/waivers";

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

/**
 * Pure: tax is calculated elsewhere (Stripe Tax, per line — see repriceOrder)
 * and passed in, so this stays a plain sum.
 */
export function calculateOrderTotals(
  items: OrderTotalsInput[],
  tipCents = 0,
  taxCents = 0,
): OrderTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);

  const totalCents = subtotalCents - discountCents + taxCents + tipCents;

  return { subtotalCents, discountCents, taxCents, tipCents, totalCents };
}

/** What every POS order response includes. */
export const POS_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  customer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PosOrderInclude;

export type PosOrderWithDetails = Prisma.PosOrderGetPayload<{ include: typeof POS_ORDER_INCLUDE }>;

/**
 * Recomputes an order's totals from its current line items (never trusting
 * client-supplied totals) and persists them. Tax is the sum of each line's
 * stored taxCents, which repriceOrder keeps current — so this is safe to call
 * for tip-only changes without another Stripe Tax call.
 */
export async function recalculateOrderTotals(
  orderId: string,
  tipCentsOverride?: number,
): Promise<PosOrderWithDetails> {
  const order = await prisma.posOrder.findUniqueOrThrow({ where: { id: orderId } });
  const items = await prisma.posOrderItem.findMany({ where: { orderId } });

  const totals = calculateOrderTotals(
    items.map((item) => ({
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      discountCents: item.discountCents,
    })),
    tipCentsOverride ?? order.tipCents,
    items.reduce((sum, item) => sum + item.taxCents, 0),
  );

  return prisma.posOrder.update({
    where: { id: orderId },
    data: totals,
    include: POS_ORDER_INCLUDE,
  });
}

/**
 * Recalculates Stripe Tax for the order's current lines, stores tax per line
 * and the calculation id, then recomputes totals. Call after every item
 * change. `taxWarning` is non-null when tax fell back to zero and staff should
 * be told (the terminal shows it as a banner) — checkout is never blocked.
 */
export async function repriceOrder(
  orderId: string,
): Promise<{ order: PosOrderWithDetails; taxWarning: string | null }> {
  const order = await prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, location: true },
  });

  const tax = await calculatePosTax(
    order.location,
    order.items.map((item) => ({
      reference: item.id,
      amountCents: item.totalCents,
      quantity: item.quantity,
      taxCode: item.taxCode,
    })),
  );

  const itemUpdates = order.items
    .filter((item) => item.taxCents !== (tax.taxByReference.get(item.id) ?? 0))
    .map((item) =>
      prisma.posOrderItem.update({
        where: { id: item.id },
        data: { taxCents: tax.taxByReference.get(item.id) ?? 0 },
      }),
    );

  await prisma.$transaction([
    ...itemUpdates,
    prisma.posOrder.update({
      where: { id: orderId },
      data: { stripeTaxCalculationId: tax.calculationId },
    }),
  ]);

  const updated = await recalculateOrderTotals(orderId);
  return { order: updated, taxWarning: tax.warning };
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

/** A PosOrderItem.metadata value as a plain object ({} for anything else). */
export function metadataObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
}

/** The StudioSession a DROP_IN line books into, or null for legacy lines without one. */
export function dropInSessionId(metadata: Prisma.JsonValue | null | undefined): string | null {
  const id = metadataObject(metadata).studioSessionId;
  return typeof id === "string" && id ? id : null;
}

export interface PaymentBlock {
  status: 400 | 409;
  error: string;
  message: string;
}

/**
 * Whether the order may take a payment. Every payment-start route calls this
 * and returns `{ error, message }` with `status` when it's non-null.
 *
 * Drop-in lines book a real seat, so they need a customer and a seat. Seats are
 * re-checked only before the first payment lands: once money has been taken on
 * a split payment, refusing the next leg would strand a half-paid order, so
 * completion falls back to WAITLIST instead (see createDropInBookings).
 */
export async function checkOrderPayable(orderId: string): Promise<PaymentBlock | null> {
  const order = await prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });

  const dropIns = order.items.filter((i) => i.itemType === "DROP_IN");
  if (dropIns.length === 0) return null;

  if (!order.customerId) {
    return {
      status: 400,
      error: "CUSTOMER_REQUIRED",
      message:
        "This order books a class seat, so it needs a customer. Attach the customer before taking payment.",
    };
  }

  if (order.payments.some((p) => p.status === "SUCCEEDED")) return null;

  for (const item of dropIns) {
    const studioSessionId = dropInSessionId(item.metadata);
    if (!studioSessionId) {
      return {
        status: 400,
        error: "SESSION_REQUIRED",
        message: `${item.name} isn't tied to a class session. Remove it and add it again from the Drop-ins tab.`,
      };
    }

    const session = await prisma.studioSession.findUnique({
      where: { id: studioSessionId },
      include: { _count: { select: { bookings: { where: { status: "CONFIRMED" } } } } },
    });
    if (!session || session.isCancelled) {
      return {
        status: 409,
        error: "SESSION_CANCELLED",
        message: `${item.name} has been cancelled. Remove it from the order.`,
      };
    }

    // Everyone needs a signed waiver for the studio they're booking at, POS
    // included (Sam, 2026-09-12) — same rule as the online booking routes.
    const unsignedWaiver = await findUnsignedWaiver(order.customerId, session.locationId);
    if (unsignedWaiver) {
      return {
        status: 409,
        error: "WAIVER_REQUIRED",
        message: `This customer hasn't signed the ${unsignedWaiver.locationName} waiver. Have them sign it (they can sign in and go to /waiver) before taking payment.`,
      };
    }

    const existing = await prisma.booking.findFirst({
      where: { userId: order.customerId, studioSessionId, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (existing) {
      return {
        status: 409,
        error: "ALREADY_BOOKED",
        message: `This customer is already booked into ${item.name}.`,
      };
    }

    if (session._count.bookings >= session.capacity) {
      return { status: 409, error: "SESSION_FULL", message: `${item.name} is full.` };
    }
  }

  return null;
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

type OrderForCompletion = Prisma.PosOrderGetPayload<{ include: { items: true; payments: true } }>;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * One Booking per DROP_IN line (Booking.posOrderItemId is unique, so a retry is
 * a no-op). Runs after the money is taken, so it never throws: a session that
 * filled up since the payment check gets a WAITLIST booking and a note on the
 * order for staff, rather than a failed completion.
 */
async function createDropInBookings(order: OrderForCompletion): Promise<string[]> {
  const notes: string[] = [];

  for (const item of order.items.filter((i) => i.itemType === "DROP_IN")) {
    const studioSessionId = dropInSessionId(item.metadata);
    if (!studioSessionId || !order.customerId) {
      console.error(
        `[pos] order ${order.id}: drop-in line ${item.id} has no ${studioSessionId ? "customer" : "session"}; no booking created`,
      );
      notes.push(`No booking created for ${item.name} (missing ${studioSessionId ? "customer" : "session"}).`);
      continue;
    }

    try {
      const already = await prisma.booking.findUnique({ where: { posOrderItemId: item.id } });
      if (already) continue;

      const session = await prisma.studioSession.findUnique({
        where: { id: studioSessionId },
        include: { _count: { select: { bookings: { where: { status: "CONFIRMED" } } } } },
      });
      if (!session) {
        notes.push(`No booking created for ${item.name}: the session no longer exists.`);
        continue;
      }

      const status = session._count.bookings >= session.capacity ? "WAITLIST" : "CONFIRMED";
      const booking = await prisma.booking.create({
        data: {
          userId: order.customerId,
          studioSessionId,
          status,
          source: "DROP_IN",
          amountPaidCents: item.totalCents,
          posOrderItemId: item.id,
        },
      });

      if (status === "CONFIRMED") {
        await sendInngestEvent({
          name: "booking/confirmed",
          data: { bookingId: booking.id, userId: order.customerId, studioSessionId },
        });
      } else {
        notes.push(`${item.name} was full at checkout; the customer is on the waitlist.`);
      }
    } catch (err) {
      if (isUniqueViolation(err)) continue; // a concurrent completion already booked it
      console.error(`[pos] order ${order.id}: failed to book drop-in line ${item.id}:`, err);
      notes.push(`Booking for ${item.name} failed; book the customer in manually.`);
    }
  }

  return notes;
}

/**
 * Writes firing charges back to the customer's INTAKE pieces the line was
 * attached to. When one line covers several Piece rows, weight and charge are
 * split evenly (remainder on the first) — the calculator weighs them together.
 */
async function attachFiringCharges(order: OrderForCompletion): Promise<void> {
  if (!order.customerId) return;

  for (const item of order.items.filter((i) => i.itemType === "CUSTOM")) {
    const firing = parseFiringMetadata(item.metadata);
    if (!firing?.pieceIds?.length) continue;

    try {
      const pieces = await prisma.piece.findMany({
        where: { id: { in: firing.pieceIds }, userId: order.customerId, status: "INTAKE" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (pieces.length === 0) continue;

      const n = pieces.length;
      await prisma.$transaction(
        pieces.map((piece, index) => {
          const share = (total: number) =>
            Math.floor(total / n) + (index === 0 ? total % n : 0);
          return prisma.piece.update({
            where: { id: piece.id },
            data: {
              weightOz: share(firing.weightOz),
              chargedCents: share(item.totalCents),
              posOrderItemId: item.id,
            },
          });
        }),
      );
    } catch (err) {
      console.error(`[pos] order ${order.id}: failed to attach firing line ${item.id} to pieces:`, err);
    }
  }
}

/**
 * Marks an order COMPLETED and runs one-time completion side effects the first
 * time SUCCEEDED payments cover totalCents:
 *   - mirrored Payment record (customer orders only)
 *   - gift card issuance (codes stored on the line's metadata.giftCardCodes, so
 *     the completion response and the receipt can show them)
 *   - retail stock decrement
 *   - a Booking for each drop-in line
 *   - firing charges written to the customer's pieces
 *   - the Stripe Tax transaction
 *   - pos/order.completed event
 * The atomic `updateMany` guard (status must still be OPEN) ensures this only
 * runs once even if two payment routes race to settle the balance concurrently.
 */
export async function maybeCompletePosOrder(orderId: string): Promise<PosOrderWithDetails> {
  const order = await prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });

  if (order.status !== "OPEN") {
    return prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: POS_ORDER_INCLUDE });
  }

  const owed = remainingBalanceCents(order, order.payments);
  if (owed > 0) {
    return prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: POS_ORDER_INCLUDE });
  }

  const { count } = await prisma.posOrder.updateMany({
    where: { id: orderId, status: "OPEN" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  if (count === 0) {
    // Lost the race to a concurrent completion — return the current state.
    return prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: POS_ORDER_INCLUDE });
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
    const codes: string[] = [];
    for (let i = 0; i < item.quantity; i++) {
      const card = await createGiftCardWithUniqueCode({
        initialCents: item.unitPriceCents,
        balanceCents: item.unitPriceCents,
        purchasedById: order.customerId,
        locationId: order.locationId,
      });
      codes.push(card.code);
    }
    await prisma.posOrderItem.update({
      where: { id: item.id },
      data: { metadata: { ...metadataObject(item.metadata), giftCardCodes: codes } },
    });
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

  const bookingNotes = await createDropInBookings(order);
  if (bookingNotes.length > 0) {
    await prisma.posOrder.update({
      where: { id: orderId },
      data: { note: [order.note, ...bookingNotes].filter(Boolean).join("\n") },
    });
  }

  await attachFiringCharges(order);

  if (order.stripeTaxCalculationId && order.taxCents > 0) {
    await recordTaxTransaction(order.stripeTaxCalculationId, `pos-order-${order.orderNumber}`);
  }

  await sendInngestEvent({ name: "pos/order.completed", data: { orderId: order.id } });

  return prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: POS_ORDER_INCLUDE });
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
