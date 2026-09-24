import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendInngestEvent } from "@/lib/inngest";
import { calculatePosTax, recordTaxTransaction } from "@/lib/stripeTax";
import { findUnsignedWaiver } from "@/lib/waivers";
import { formatMountainTime } from "@/lib/timezone";
import {
  calculateDiscounts,
  checkDiscountUsable,
  pickAutomaticDiscounts,
  DISCOUNT_REFUSAL_MESSAGES,
  type DiscountRefusal,
} from "@/lib/discounts";
import type { FiringRates } from "@/lib/firing";
import { generateGiftCardCode, giftCardCodeCandidates } from "@/lib/giftCardCode";

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
  // Named discounts on the order (staff applied, promo code, automatic member
  // discount), with what each one took off. See repriceOrder.
  discounts: {
    orderBy: { createdAt: "asc" },
    include: {
      discountCode: {
        select: { id: true, code: true, type: true, value: true, scope: true, appliesVia: true },
      },
    },
  },
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
 * The dollar discount staff typed on a line. It lives in
 * metadata.manualDiscountCents because PosOrderItem.discountCents holds the
 * line's whole discount (manual plus its share of every named discount). A
 * line from before named discounts existed has no key, and its discountCents
 * was all manual.
 */
export function manualDiscountCents(item: { discountCents: number; metadata: Prisma.JsonValue | null }): number {
  const stored = metadataObject(item.metadata).manualDiscountCents;
  return typeof stored === "number" && Number.isInteger(stored) && stored >= 0 ? stored : item.discountCents;
}

/**
 * How staff tie an order to a group event (GROUPEXTRAS20): the discount route
 * checks the event and writes it at the start of the PosOrderDiscount note.
 */
export const GROUP_EVENT_NOTE_PREFIX = "Group event: ";

/** Group events are the private, flat-priced class types (catalog §2.1 #5). */
export const GROUP_EVENT_SESSION_TYPE = {
  priceUnit: "FLAT",
  isPublic: false,
  isBusyWindow: false,
} satisfies Prisma.SessionTypeWhereInput;

/** How far back a group event can be and still have its extras rung up against it. */
export const GROUP_EVENT_LOOKBACK_DAYS = 7;

/** Discount rows that can be used right now at this studio (per-customer rules aside). */
function usableDiscountWhere(locationId: string, now: Date): Prisma.DiscountCodeWhereInput {
  return {
    isActive: true,
    archivedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      { OR: [{ locationId: null }, { locationId }] },
    ],
  };
}

/**
 * Months of the customer's commitment, from their ACTIVE membership:
 * CommitmentTerm.months when the membership has a term, else the plan's
 * commitmentMonths. Null = no commitment (or no membership). With more than
 * one active membership the longest commitment wins.
 */
export async function getCommitmentMonths(userId: string | null): Promise<number | null> {
  if (!userId) return null;
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      commitmentTerm: { select: { months: true } },
      plan: { select: { commitmentMonths: true } },
    },
  });
  const months = memberships
    .map((m) => (m.commitmentTerm ? m.commitmentTerm.months : m.plan.commitmentMonths))
    .filter((m): m is number => typeof m === "number" && m > 0);
  return months.length > 0 ? Math.max(...months) : null;
}

/**
 * Puts the right AUTOMATIC discount rows on an open order and takes the wrong
 * ones off: a 12 month member gets COMMIT12 the moment they're attached, and
 * loses it if the customer is swapped or removed.
 */
async function syncAutomaticDiscounts(order: {
  id: string;
  locationId: string;
  discounts: { id: string; automatic: boolean; discountCodeId: string | null }[];
}, commitmentMonths: number | null): Promise<void> {
  const candidates = await prisma.discountCode.findMany({
    where: { ...usableDiscountWhere(order.locationId, new Date()), appliesVia: "AUTOMATIC" },
    select: { id: true, code: true, name: true, autoCommitmentMonths: true },
  });
  const wanted = pickAutomaticDiscounts(candidates, commitmentMonths);
  const wantedIds = new Set(wanted.map((d) => d.id));

  const current = order.discounts.filter((d) => d.automatic);
  const stale = current.filter((d) => !d.discountCodeId || !wantedIds.has(d.discountCodeId));
  const missing = wanted.filter((w) => !current.some((d) => d.discountCodeId === w.id));
  if (stale.length === 0 && missing.length === 0) return;

  await prisma.$transaction([
    prisma.posOrderDiscount.deleteMany({ where: { id: { in: stale.map((d) => d.id) } } }),
    ...missing.map((d) =>
      prisma.posOrderDiscount.create({
        data: { orderId: order.id, discountCodeId: d.id, name: d.name ?? d.code, automatic: true },
      }),
    ),
  ]);
}

const REPRICE_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  location: true,
  discounts: { include: { discountCode: true } },
} satisfies Prisma.PosOrderInclude;

/**
 * Reprices an open order from its current lines. Call after every change to
 * items, discounts or the attached customer:
 *   1. attaches / detaches automatic member discounts for the customer
 *   2. runs the discount engine (src/lib/discounts.ts): the manual per-line
 *      discount first, then named discounts, and stores each line's
 *      discountCents / totalCents and each discount's amountCents
 *   3. recalculates Stripe Tax on the post-discount line totals, stores tax per
 *      line and the calculation id
 *   4. recomputes the order totals
 * `taxWarning` is non-null when tax fell back to zero and staff should be told
 * (the terminal shows it as a banner) — checkout is never blocked.
 */
export async function repriceOrder(
  orderId: string,
): Promise<{ order: PosOrderWithDetails; taxWarning: string | null }> {
  let order = await prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: REPRICE_INCLUDE });

  const commitmentMonths = await getCommitmentMonths(order.customerId);
  if (order.status === "OPEN") {
    await syncAutomaticDiscounts(order, commitmentMonths);
    order = await prisma.posOrder.findUniqueOrThrow({ where: { id: orderId }, include: REPRICE_INCLUDE });
  }

  const priced = calculateDiscounts(
    order.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      category: item.category,
      productSlug: asString(metadataObject(item.metadata).productSlug),
      sessionTypeId: item.itemType === "DROP_IN" ? item.refId : null,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      manualDiscountCents: manualDiscountCents(item),
    })),
    order.discounts.flatMap((d) =>
      d.discountCode
        ? [
            {
              id: d.id,
              type: d.discountCode.type,
              value: d.discountCode.value,
              scope: d.discountCode.scope,
              automatic: d.automatic,
              autoCommitmentMonths: d.discountCode.autoCommitmentMonths,
              sessionTypeId: d.discountCode.sessionTypeId,
              productSlug: d.discountCode.productSlug,
              maxUnits: d.discountCode.maxUnits,
              requiresGroupEvent: d.discountCode.requiresGroupEvent,
              appliedAt: d.createdAt,
            },
          ]
        : [],
    ),
    {
      commitmentMonths,
      isGroupEventOrder: order.discounts.some(
        (d) => d.discountCode?.requiresGroupEvent && d.note?.startsWith(GROUP_EVENT_NOTE_PREFIX),
      ),
    },
  );

  const tax = await calculatePosTax(
    order.location,
    order.items.map((item) => ({
      reference: item.id,
      amountCents: priced.lines[item.id].totalCents,
      quantity: item.quantity,
      taxCode: item.taxCode,
    })),
  );

  const itemUpdates = order.items.flatMap((item) => {
    const line = priced.lines[item.id];
    const taxCents = tax.taxByReference.get(item.id) ?? 0;
    const meta = metadataObject(item.metadata);
    const data: Prisma.PosOrderItemUpdateInput = {};
    if (item.discountCents !== line.discountCents) data.discountCents = line.discountCents;
    if (item.totalCents !== line.totalCents) data.totalCents = line.totalCents;
    if (item.taxCents !== taxCents) data.taxCents = taxCents;
    if (meta.manualDiscountCents !== line.manualDiscountCents) {
      data.metadata = { ...meta, manualDiscountCents: line.manualDiscountCents };
    }
    return Object.keys(data).length > 0 ? [prisma.posOrderItem.update({ where: { id: item.id }, data })] : [];
  });

  const discountUpdates = order.discounts
    .filter((d) => d.amountCents !== (priced.discountAmounts[d.id] ?? 0))
    .map((d) =>
      prisma.posOrderDiscount.update({
        where: { id: d.id },
        data: { amountCents: priced.discountAmounts[d.id] ?? 0 },
      }),
    );

  await prisma.$transaction([
    ...itemUpdates,
    ...discountUpdates,
    prisma.posOrder.update({
      where: { id: orderId },
      data: { stripeTaxCalculationId: tax.calculationId },
    }),
  ]);

  const updated = await recalculateOrderTotals(orderId);
  return { order: updated, taxWarning: tax.warning };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** "Once per customer per year" is a rolling 365 days, not a calendar year. */
const CUSTOMER_LIMIT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

/** Times this customer used the discount in the last year. Voided sales don't count. */
export async function countCustomerDiscountUses(
  discountCodeId: string,
  userId: string,
  now = new Date(),
): Promise<number> {
  const redemptions = await prisma.discountRedemption.findMany({
    where: { discountCodeId, userId, createdAt: { gte: new Date(now.getTime() - CUSTOMER_LIMIT_WINDOW_MS) } },
    select: { posOrderId: true },
  });
  const orderIds = redemptions.flatMap((r) => (r.posOrderId ? [r.posOrderId] : []));
  if (orderIds.length === 0) return redemptions.length;

  const voided = await prisma.posOrder.findMany({
    where: { id: { in: orderIds }, status: "VOIDED" },
    select: { id: true },
  });
  const voidedIds = new Set(voided.map((o) => o.id));
  return redemptions.filter((r) => !r.posOrderId || !voidedIds.has(r.posOrderId)).length;
}

/**
 * The shared discount rules (src/lib/discounts.ts checkDiscountUsable) with
 * the database lookups filled in. Null when the discount can be used.
 */
export async function refuseDiscount(
  discount: Prisma.DiscountCodeGetPayload<object>,
  args: { locationId: string | null; customerId: string | null; note?: string | null; isGroupEventOrder?: boolean },
): Promise<{ error: DiscountRefusal; message: string } | null> {
  const now = new Date();
  const customerUsesThisYear =
    discount.maxUsesPerCustomerPerYear != null && args.customerId
      ? await countCustomerDiscountUses(discount.id, args.customerId, now)
      : args.customerId
        ? 0
        : null;
  const refusal = checkDiscountUsable(discount, {
    now,
    locationId: args.locationId,
    customerUsesThisYear,
    note: args.note,
    isGroupEventOrder: args.isGroupEventOrder,
  });
  return refusal ? { error: refusal, message: DISCOUNT_REFUSAL_MESSAGES[refusal] } : null;
}

/** How long after their last course session a student still counts as enrolled (glaze firing lags the course). */
const ENROLLED_LOOKBACK_DAYS = 90;

/**
 * Who may buy members-only products (member firing): an ACTIVE member, or an
 * enrolled student — someone with a confirmed booking in a COURSE-kind class
 * that is upcoming or was in the last 90 days.
 */
export async function isMemberOrEnrolledStudent(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const since = new Date(Date.now() - ENROLLED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [membership, courseBooking] = await Promise.all([
    prisma.membership.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } }),
    prisma.booking.findFirst({
      where: {
        userId,
        status: "CONFIRMED",
        studioSession: { isCancelled: false, startsAt: { gte: since }, sessionType: { kind: "COURSE" } },
      },
      select: { id: true },
    }),
  ]);
  return membership !== null || courseBooking !== null;
}

export const MEMBERS_ONLY_MESSAGE =
  "Member firing is only for active members and enrolled course students. Attach the member or student to this order first.";

/** Class pack credits the customer holds (the ledger's running sum). Never expire, not shareable. */
export async function getClassCreditBalance(userId: string): Promise<number> {
  const sum = await prisma.classCreditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return sum._sum.delta ?? 0;
}

/** metadata.kind on a member firing line added by POST /api/pos/orders/[id]/firing. */
export const MEMBER_FIRING_KIND = "MEMBER_FIRING";

export const GLAZE_FIRING_SLUG = "glaze-firing";
export const GLAZE_FIRING_OVERSIZE_SLUG = "glaze-firing-oversize";

/**
 * The member firing price book, read from the two by-weight firing products
 * (scripts/sync-products.ts). Null when either is missing, inactive or not
 * priced — the firing calculator is then off rather than guessing a rate.
 */
export async function getFiringProducts() {
  const products = await prisma.retailProduct.findMany({
    where: {
      slug: { in: [GLAZE_FIRING_SLUG, GLAZE_FIRING_OVERSIZE_SLUG] },
      isActive: true,
      isPriced: true,
      archivedAt: null,
    },
  });
  const standard = products.find((p) => p.slug === GLAZE_FIRING_SLUG);
  const oversize = products.find((p) => p.slug === GLAZE_FIRING_OVERSIZE_SLUG);
  if (!standard || !oversize) return null;

  const rates: FiringRates = {
    standardCentsPerLb: standard.priceCents,
    oversizeCentsPerLb: oversize.priceCents,
    // One minimum per piece whatever its size; the catalog has a single value.
    minChargeCents: Math.max(standard.minChargeCents ?? 0, oversize.minChargeCents ?? 0),
  };
  return { standard, oversize, rates };
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

/**
 * Every StudioSession a DROP_IN line books. A class is one session; a course
 * line (sold once at the course price) carries all of its remaining sessions
 * in metadata.courseSessionIds, the first of which is also studioSessionId.
 */
export function dropInSessionIds(metadata: Prisma.JsonValue | null | undefined): string[] {
  const course = metadataObject(metadata).courseSessionIds;
  if (Array.isArray(course)) {
    const ids = course.filter((id): id is string => typeof id === "string" && id !== "");
    if (ids.length > 0) return ids;
  }
  const single = dropInSessionId(metadata);
  return single ? [single] : [];
}

/** Bookings a course line made beyond the first (which is tied by Booking.posOrderItemId). */
export function courseBookingIds(metadata: Prisma.JsonValue | null | undefined): string[] {
  const ids = metadataObject(metadata).courseBookingIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
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
    include: { items: true, payments: true, discounts: { include: { discountCode: true } } },
  });

  const dropIns = order.items.filter((i) => i.itemType === "DROP_IN");
  const classPacks = order.items.filter((i) => i.category === "CLASS_PACK");

  if (!order.customerId && (dropIns.length > 0 || classPacks.length > 0)) {
    return {
      status: 400,
      error: "CUSTOMER_REQUIRED",
      message:
        dropIns.length > 0
          ? "This order books a class seat, so it needs a customer. Attach the customer before taking payment."
          : "Class pack credits go on a customer's account. Attach the customer before taking payment.",
    };
  }

  if (order.payments.some((p) => p.status === "SUCCEEDED")) return null;

  // The customer can change after a line or a discount went on, so the rules
  // that depend on who they are are checked again before money is taken.
  const membersOnly = order.items.filter((i) => metadataObject(i.metadata).membersOnly === true);
  if (membersOnly.length > 0 && !(await isMemberOrEnrolledStudent(order.customerId))) {
    return { status: 409, error: "MEMBERS_ONLY", message: MEMBERS_ONLY_MESSAGE };
  }
  for (const applied of order.discounts) {
    if (!applied.discountCode || applied.discountCode.maxUsesPerCustomerPerYear == null) continue;
    const uses = order.customerId
      ? await countCustomerDiscountUses(applied.discountCode.id, order.customerId)
      : null;
    if (uses === null || uses >= applied.discountCode.maxUsesPerCustomerPerYear) {
      return {
        status: 409,
        error: uses === null ? "CUSTOMER_REQUIRED" : "DISCOUNT_CUSTOMER_LIMIT",
        message:
          uses === null
            ? `${applied.name} is limited per customer. Attach the customer, or remove the discount.`
            : `This customer has already used ${applied.name} this year. Remove the discount to continue.`,
      };
    }
  }

  if (dropIns.length === 0 || !order.customerId) return null;

  for (const item of dropIns) {
    const sessionIds = dropInSessionIds(item.metadata);
    if (sessionIds.length === 0) {
      return {
        status: 400,
        error: "SESSION_REQUIRED",
        message: `${item.name} isn't tied to a class session. Remove it and add it again from the Classes tab.`,
      };
    }

    // A course line books every remaining session, so each one is checked.
    for (const studioSessionId of sessionIds) {
      const session = await prisma.studioSession.findUnique({
        where: { id: studioSessionId },
        include: {
          sessionType: { select: { id: true, kind: true } },
          _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
        },
      });
      if (!session || session.isCancelled) {
        return {
          status: 409,
          error: "SESSION_CANCELLED",
          message:
            sessionIds.length > 1
              ? `A session of ${item.name} has been cancelled. Remove it from the order and add the course again.`
              : `${item.name} has been cancelled. Remove it from the order.`,
        };
      }

      // Everyone needs a signed waiver for the studio they're booking at, POS
      // included (Sam, 2026-09-12) — same rule as the online booking routes.
      const unsignedWaiver = await findUnsignedWaiver(order.customerId, session.locationId, "CLASS", {
        sessionTypeId: session.sessionType.id,
        sessionKind: session.sessionType.kind,
      });
      if (unsignedWaiver) {
        return {
          status: 409,
          error: "WAIVER_REQUIRED",
          message: `This customer hasn't signed the ${unsignedWaiver.name}. Have them sign it (they can sign in and go to /waiver, or use Send waiver) before taking payment.`,
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
        return {
          status: 409,
          error: "SESSION_FULL",
          message:
            sessionIds.length > 1
              ? `${item.name} is full on ${formatMountainTime(session.startsAt, "datetime")}.`
              : `${item.name} is full.`,
        };
      }
    }
  }

  return null;
}

// One alphabet for every issuer (POS and admin); see src/lib/giftCardCode.ts.
export { generateGiftCardCode };

/** The gift card a typed code refers to, whatever separators it was typed or stored with. */
export async function findGiftCardByCode(input: string) {
  const candidates = giftCardCodeCandidates(input);
  if (candidates.length === 0) return null;
  return prisma.giftCard.findFirst({ where: { code: { in: candidates } }, orderBy: { createdAt: "asc" } });
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

type OrderForCompletion = Prisma.PosOrderGetPayload<{
  include: { items: true; payments: true; discounts: true };
}>;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * One Booking per session a DROP_IN line books. Booking.posOrderItemId is
 * unique, so the line's first session carries it (and the amount paid) and a
 * retry is a no-op. A course line books every remaining session: the later
 * bookings are $0 (the course was paid once, on the first) and their ids are
 * kept on the line as metadata.courseBookingIds so a void can cancel them.
 * Runs after the money is taken, so it never throws: a session that filled up
 * since the payment check gets a WAITLIST booking and a note on the order for
 * staff, rather than a failed completion.
 */
async function createDropInBookings(order: OrderForCompletion): Promise<string[]> {
  const notes: string[] = [];

  for (const item of order.items.filter((i) => i.itemType === "DROP_IN")) {
    const sessionIds = dropInSessionIds(item.metadata);
    if (sessionIds.length === 0 || !order.customerId) {
      console.error(
        `[pos] order ${order.id}: drop-in line ${item.id} has no ${sessionIds.length > 0 ? "customer" : "session"}; no booking created`,
      );
      notes.push(`No booking created for ${item.name} (missing ${sessionIds.length > 0 ? "customer" : "session"}).`);
      continue;
    }

    const extraBookingIds = courseBookingIds(item.metadata);
    for (const [index, studioSessionId] of sessionIds.entries()) {
      const isFirst = index === 0;
      try {
        // The first session is guarded by the unique posOrderItemId; the rest
        // by the customer already holding a booking in that session.
        const already = isFirst
          ? await prisma.booking.findUnique({ where: { posOrderItemId: item.id } })
          : await prisma.booking.findFirst({
              where: { userId: order.customerId, studioSessionId, status: { not: "CANCELLED" } },
            });
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
            amountPaidCents: isFirst ? item.totalCents : 0,
            posOrderItemId: isFirst ? item.id : null,
          },
        });
        if (!isFirst) extraBookingIds.push(booking.id);

        if (status === "CONFIRMED") {
          await sendInngestEvent({
            name: "booking/confirmed",
            data: { bookingId: booking.id, userId: order.customerId, studioSessionId },
          });
        } else {
          notes.push(
            sessionIds.length > 1
              ? `${item.name} was full on ${formatMountainTime(session.startsAt, "datetime")} at checkout; the customer is on the waitlist for that session.`
              : `${item.name} was full at checkout; the customer is on the waitlist.`,
          );
        }
      } catch (err) {
        if (isUniqueViolation(err)) continue; // a concurrent completion already booked it
        console.error(`[pos] order ${order.id}: failed to book drop-in line ${item.id} into ${studioSessionId}:`, err);
        notes.push(`Booking for ${item.name} failed; book the customer in manually.`);
      }
    }

    if (extraBookingIds.length > 0) {
      await prisma.posOrderItem
        .update({
          where: { id: item.id },
          data: { metadata: { ...metadataObject(item.metadata), courseBookingIds: extraBookingIds } },
        })
        .catch((err) => {
          console.error(`[pos] order ${order.id}: failed to record course bookings on line ${item.id}:`, err);
        });
    }
  }

  return notes;
}

/** Writes firing charges back to the customer's INTAKE pieces the lines were attached to. */
async function attachFiringCharges(order: OrderForCompletion): Promise<void> {
  if (!order.customerId) return;

  // Member firing lines (one per piece, see the firing route) name their
  // INTAKE piece directly, so there is nothing to split.
  for (const item of order.items) {
    const meta = metadataObject(item.metadata);
    if (meta.kind !== MEMBER_FIRING_KIND || typeof meta.pieceId !== "string") continue;
    const weightTenths = typeof meta.weightTenths === "number" ? meta.weightTenths : 0;
    await prisma.piece
      .updateMany({
        where: { id: meta.pieceId, userId: order.customerId, status: "INTAKE" },
        data: {
          weightOz: Math.round(weightTenths * 1.6),
          chargedCents: item.totalCents,
          posOrderItemId: item.id,
        },
      })
      .catch((err) => {
        console.error(`[pos] order ${order.id}: failed to attach firing line ${item.id} to its piece:`, err);
      });
  }
}

/**
 * Class packs: one PURCHASE ledger row per pack line, for the order's customer
 * (checkOrderPayable refuses a pack with no customer). Credits never expire
 * and are not shareable, so there is nothing else to record.
 */
async function grantClassPackCredits(order: OrderForCompletion): Promise<void> {
  for (const item of order.items.filter((i) => i.category === "CLASS_PACK")) {
    const perPack = metadataObject(item.metadata).classCredits;
    if (typeof perPack !== "number" || perPack <= 0) continue;
    if (!order.customerId) {
      console.error(`[pos] order ${order.id}: class pack line ${item.id} has no customer; no credits granted`);
      await prisma.posOrder
        .update({
          where: { id: order.id },
          data: { note: [order.note, `No class credits granted for ${item.name} (no customer on the order).`].filter(Boolean).join("\n") },
        })
        .catch(() => {});
      continue;
    }
    try {
      const already = await prisma.classCreditLedger.findFirst({
        where: { posOrderItemId: item.id, type: "PURCHASE" },
        select: { id: true },
      });
      if (already) continue;
      await prisma.classCreditLedger.create({
        data: {
          userId: order.customerId,
          delta: perPack * item.quantity,
          type: "PURCHASE",
          note: `${item.name}, POS order #${order.orderNumber}`,
          posOrderItemId: item.id,
        },
      });
    } catch (err) {
      console.error(`[pos] order ${order.id}: failed to grant class credits for line ${item.id}:`, err);
    }
  }
}

/**
 * One DiscountRedemption per named discount that took something off, and the
 * code's usedCount. This is what maxUses and the per-customer yearly limit
 * count (see countCustomerDiscountUses).
 */
async function recordDiscountRedemptions(order: OrderForCompletion): Promise<void> {
  for (const applied of order.discounts) {
    if (!applied.discountCodeId || applied.amountCents <= 0) continue;
    try {
      await prisma.$transaction([
        prisma.discountRedemption.create({
          data: {
            discountCodeId: applied.discountCodeId,
            userId: order.customerId,
            posOrderId: order.id,
            amountCents: applied.amountCents,
            note: applied.note,
          },
        }),
        prisma.discountCode.update({
          where: { id: applied.discountCodeId },
          data: { usedCount: { increment: 1 } },
        }),
      ]);
    } catch (err) {
      console.error(`[pos] order ${order.id}: failed to record redemption of ${applied.name}:`, err);
    }
  }
}

/**
 * Undoes the completion side effects that live outside the order when a
 * completed order is voided: class pack credits come back off the customer
 * (never below zero — credits already spent stay spent) and discount uses are
 * released. Payments are not refunded here; see the void route.
 */
export async function reverseCompletionSideEffects(orderId: string): Promise<void> {
  const order = await prisma.posOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, discounts: true },
  });

  for (const item of order.items.filter((i) => i.category === "CLASS_PACK")) {
    const grant = await prisma.classCreditLedger.findFirst({
      where: { posOrderItemId: item.id, type: "PURCHASE" },
    });
    const reversed = await prisma.classCreditLedger.findFirst({
      where: { posOrderItemId: item.id, type: "VOID" },
      select: { id: true },
    });
    if (!grant || reversed) continue;
    const takeBack = Math.min(grant.delta, Math.max(0, await getClassCreditBalance(grant.userId)));
    await prisma.classCreditLedger.create({
      data: {
        userId: grant.userId,
        delta: -takeBack,
        type: "VOID",
        note: `POS order #${order.orderNumber} voided`,
        posOrderItemId: item.id,
      },
    });
  }

  // Redemption rows stay as history; countCustomerDiscountUses skips voided orders.
  const codeIds = order.discounts.flatMap((d) => (d.discountCodeId && d.amountCents > 0 ? [d.discountCodeId] : []));
  if (codeIds.length > 0) {
    await prisma.discountCode.updateMany({
      where: { id: { in: codeIds }, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}

/**
 * Marks an order COMPLETED and runs one-time completion side effects the first
 * time SUCCEEDED payments cover totalCents:
 *   - mirrored Payment record (customer orders only)
 *   - gift card issuance (codes stored on the line's metadata.giftCardCodes, so
 *     the completion response and the receipt can show them)
 *   - retail stock decrement (tracked products only)
 *   - class pack credits and discount redemptions
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
    include: { items: true, payments: true, discounts: true },
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

  // Pieces, firing, clay by the pound, packs and shipping carry no stock
  // (trackInventory false), so only tracked products are decremented.
  for (const item of order.items.filter((i) => i.itemType === "RETAIL" && i.refId)) {
    await prisma.retailProduct
      .updateMany({
        where: { id: item.refId!, trackInventory: true },
        data: { inventory: { decrement: item.quantity } },
      })
      .catch(() => {
        // Non-fatal: don't block order completion on a stock update failure
      });
  }

  await grantClassPackCredits(order);
  await recordDiscountRedemptions(order);

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
