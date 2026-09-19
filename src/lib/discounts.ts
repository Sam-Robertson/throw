/**
 * Discount engine (docs/throw-catalog.md §6). Pure: no database, no clock
 * unless one is passed in. The POS (src/lib/pos.ts repriceOrder) and online
 * class checkout both price through here.
 *
 * What a discount can touch, by scope:
 *   RETAIL      RETAIL lines whose category is RETAIL. Never pieces, firing,
 *               clay, class packs or shipping ("retail only, never clay or
 *               firing"), and never custom lines.
 *   PIECES      RETAIL lines whose category is PIECES.
 *   CLASSES     DROP_IN lines.
 *   EVERYTHING  every line except gift cards and memberships.
 * Gift card lines are never discounted (a gift card is money, not goods), and
 * neither are membership lines (the POS doesn't start subscriptions).
 * `sessionTypeId` narrows a discount to one class type and `productSlug` to one
 * product, whatever the scope.
 *
 * Order of application — deterministic, and independent of the order the
 * discounts are passed in:
 *   1. the manual per-line dollar discount staff typed on a line
 *   2. automatic discounts (member commitment)
 *   3. percent discounts
 *   4. fixed-amount discounts
 *   ties: the order they were applied to the order (`appliedAt`), then `id`.
 * Each discount works on what is LEFT of a line after the ones before it, so
 * 10% then 20% is 28% off, never 30%, and a line can never go below zero.
 *
 * `maxUnits` caps how many units one discount touches across the whole order.
 * The most expensive eligible units are discounted first (ties: line order):
 * "one free piece" then always means the dearest one, which is what staff and
 * customers expect, and the result doesn't depend on the order lines were rung up.
 *
 * Percent amounts are computed per line on the eligible amount and rounded to
 * the cent (halves up). A fixed amount is taken off the eligible lines in
 * proportion to their value, and is capped at what those lines are worth.
 */

export type DiscountScope = "RETAIL" | "PIECES" | "CLASSES" | "EVERYTHING";
export type DiscountAppliesVia = "AUTOMATIC" | "CODE" | "STAFF";
export type DiscountType = "percent" | "fixed_cents";

export const DISCOUNT_SCOPES: DiscountScope[] = ["EVERYTHING", "RETAIL", "PIECES", "CLASSES"];
export const DISCOUNT_APPLIES_VIA: DiscountAppliesVia[] = ["CODE", "STAFF", "AUTOMATIC"];
export const DISCOUNT_TYPES: DiscountType[] = ["percent", "fixed_cents"];

export interface DiscountLine {
  id: string;
  /** PosOrderItem.itemType: RETAIL | DROP_IN | MEMBERSHIP | GIFT_CARD | CUSTOM */
  itemType: string;
  /** RetailProduct.category at the time of sale. Null on RETAIL lines means RETAIL (rows older than categories). */
  category: string | null;
  /** RETAIL lines: the product's slug. */
  productSlug?: string | null;
  /** DROP_IN lines: the class type. */
  sessionTypeId?: string | null;
  quantity: number;
  unitPriceCents: number;
  /** Dollar discount staff typed on this line; comes off before any named discount. */
  manualDiscountCents?: number;
}

export interface AppliedDiscount {
  /** PosOrderDiscount id (or any stable id). Used for tie-breaking and in the result. */
  id: string;
  type: DiscountType | string;
  /** Percent 0–100, or cents. */
  value: number;
  scope: DiscountScope | string;
  automatic?: boolean;
  autoCommitmentMonths?: number | null;
  sessionTypeId?: string | null;
  productSlug?: string | null;
  maxUnits?: number | null;
  requiresGroupEvent?: boolean;
  /** When it was put on the order; earlier goes first within its group. */
  appliedAt?: Date | string | number | null;
}

export interface DiscountContext {
  /** Months of the attached customer's active membership commitment; null when none. */
  commitmentMonths: number | null;
  /** The order is tied to a group event (staff picked the event when applying the discount). */
  isGroupEventOrder: boolean;
}

export interface DiscountResult {
  /** Cents each discount took off, keyed by AppliedDiscount.id. Zero when nothing on the order qualified. */
  discountAmounts: Record<string, number>;
  /** Per line: what came off and what is left. */
  lines: Record<
    string,
    {
      grossCents: number;
      manualDiscountCents: number;
      /** Named discounts only, keyed by AppliedDiscount.id. */
      byDiscount: Record<string, number>;
      /** Manual plus named: what PosOrderItem.discountCents stores. */
      discountCents: number;
      totalCents: number;
    }
  >;
  totalDiscountCents: number;
}

/** Whether `discount` may touch `line` at all (amounts aside). */
export function lineMatchesDiscount(line: DiscountLine, discount: AppliedDiscount): boolean {
  if (line.itemType === "GIFT_CARD" || line.itemType === "MEMBERSHIP") return false;

  const category = line.itemType === "RETAIL" ? (line.category ?? "RETAIL") : null;

  if (discount.sessionTypeId) {
    if (line.itemType !== "DROP_IN" || line.sessionTypeId !== discount.sessionTypeId) return false;
  }
  if (discount.productSlug) {
    if (line.itemType !== "RETAIL" || line.productSlug !== discount.productSlug) return false;
  }

  switch (discount.scope) {
    case "EVERYTHING":
      return true;
    case "RETAIL":
      return category === "RETAIL";
    case "PIECES":
      return category === "PIECES";
    case "CLASSES":
      return line.itemType === "DROP_IN";
    default:
      return false;
  }
}

/** Whether the discount is in force for this order, before looking at lines. */
function discountInForce(discount: AppliedDiscount, context: DiscountContext): boolean {
  if (discount.requiresGroupEvent && !context.isGroupEventOrder) return false;
  if (discount.automatic && discount.autoCommitmentMonths != null) {
    if (context.commitmentMonths == null || context.commitmentMonths < discount.autoCommitmentMonths) {
      return false;
    }
  }
  return true;
}

function appliedAtMs(value: AppliedDiscount["appliedAt"]): number {
  if (value == null) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function discountRank(discount: AppliedDiscount): number {
  if (discount.automatic) return 0;
  return discount.type === "percent" ? 1 : 2;
}

/** The order discounts are applied in. Exported so the UI can list them the same way. */
export function sortDiscounts<T extends AppliedDiscount>(discounts: T[]): T[] {
  return [...discounts].sort(
    (a, b) =>
      discountRank(a) - discountRank(b) ||
      appliedAtMs(a.appliedAt) - appliedAtMs(b.appliedAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * Splits `total` across `weights` in proportion, in whole cents, summing to
 * exactly `total` (largest remainder; ties to the earlier entry). With
 * total ≤ sum(weights) no share exceeds its weight.
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);

  const shares = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - shares.reduce((s, x) => s + x, 0);
  const byRemainder = weights
    .map((w, i) => ({ i, remainder: (total * w) % sum }))
    .filter((r) => r.remainder > 0)
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}

/** Units are tracked one by one, so a typo quantity can't be allowed to allocate millions. */
const MAX_LINE_QUANTITY = 10_000;

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(max, Math.max(min, n));
}

export function calculateDiscounts(
  lines: DiscountLine[],
  discounts: AppliedDiscount[],
  context: DiscountContext,
): DiscountResult {
  // What is left of every unit of every line, in cents. Working per unit is
  // what lets maxUnits mean "one piece" rather than "half of two pieces".
  const state = lines.map((line) => {
    const quantity = clampInt(line.quantity, 1, MAX_LINE_QUANTITY);
    const unitPriceCents = clampInt(line.unitPriceCents, 0, Number.MAX_SAFE_INTEGER);
    const grossCents = unitPriceCents * quantity;
    const manualDiscountCents = clampInt(line.manualDiscountCents ?? 0, 0, grossCents);
    const manualPerUnit = allocateProportionally(
      manualDiscountCents,
      Array.from({ length: quantity }, () => unitPriceCents),
    );
    return {
      line,
      grossCents,
      manualDiscountCents,
      units: manualPerUnit.map((m) => unitPriceCents - m),
      byDiscount: {} as Record<string, number>,
    };
  });

  const discountAmounts: Record<string, number> = {};

  for (const discount of sortDiscounts(discounts)) {
    discountAmounts[discount.id] = 0;
    if (!discountInForce(discount, context)) continue;

    // Every eligible unit that still has value, dearest first.
    let eligible = state
      .flatMap((s, lineIndex) =>
        lineMatchesDiscount(s.line, discount)
          ? s.units.map((cents, unitIndex) => ({ lineIndex, unitIndex, cents }))
          : [],
      )
      .filter((u) => u.cents > 0);
    if (discount.maxUnits != null) {
      eligible = eligible
        .sort((a, b) => b.cents - a.cents || a.lineIndex - b.lineIndex || a.unitIndex - b.unitIndex)
        .slice(0, Math.max(0, Math.floor(discount.maxUnits)));
    }
    if (eligible.length === 0) continue;

    let perUnit: number[];
    if (discount.type === "percent") {
      const percent = Math.min(100, Math.max(0, discount.value));
      // Rounded once per line, then spread over that line's units.
      perUnit = eligible.map(() => 0);
      const lineIndexes = [...new Set(eligible.map((u) => u.lineIndex))];
      for (const lineIndex of lineIndexes) {
        const positions = eligible.flatMap((u, i) => (u.lineIndex === lineIndex ? [i] : []));
        const lineEligibleCents = positions.reduce((s, i) => s + eligible[i].cents, 0);
        const lineAmount = Math.floor((lineEligibleCents * percent + 50) / 100);
        const shares = allocateProportionally(lineAmount, positions.map((i) => eligible[i].cents));
        positions.forEach((i, k) => (perUnit[i] = shares[k]));
      }
    } else {
      const eligibleCents = eligible.reduce((s, u) => s + u.cents, 0);
      const amount = Math.min(clampInt(discount.value, 0, Number.MAX_SAFE_INTEGER), eligibleCents);
      perUnit = allocateProportionally(amount, eligible.map((u) => u.cents));
    }

    eligible.forEach((u, i) => {
      const off = Math.min(perUnit[i], u.cents);
      if (off <= 0) return;
      const s = state[u.lineIndex];
      s.units[u.unitIndex] -= off;
      s.byDiscount[discount.id] = (s.byDiscount[discount.id] ?? 0) + off;
      discountAmounts[discount.id] += off;
    });
  }

  const result: DiscountResult["lines"] = {};
  let totalDiscountCents = 0;
  for (const s of state) {
    const totalCents = s.units.reduce((sum, c) => sum + c, 0);
    const discountCents = s.grossCents - totalCents;
    totalDiscountCents += discountCents;
    result[s.line.id] = {
      grossCents: s.grossCents,
      manualDiscountCents: s.manualDiscountCents,
      byDiscount: s.byDiscount,
      discountCents,
      totalCents,
    };
  }

  return { discountAmounts, lines: result, totalDiscountCents };
}

/**
 * Which AUTOMATIC discounts belong on an order: for a member with a
 * commitment, the single longest-commitment discount they qualify for (a
 * 12 month member gets 20%, not 10% and 20%). `candidates` must already be
 * limited to usable discounts for the order's studio.
 */
export function pickAutomaticDiscounts<T extends { id: string; autoCommitmentMonths: number | null }>(
  candidates: T[],
  commitmentMonths: number | null,
): T[] {
  if (commitmentMonths == null || commitmentMonths <= 0) return [];
  const qualifying = candidates
    .filter((d) => d.autoCommitmentMonths != null && d.autoCommitmentMonths <= commitmentMonths)
    .sort((a, b) => b.autoCommitmentMonths! - a.autoCommitmentMonths! || (a.id < b.id ? -1 : 1));
  return qualifying.slice(0, 1);
}

export interface DiscountCodeRules {
  code: string;
  isActive: boolean;
  archivedAt: Date | null;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  usedCount: number;
  locationId: string | null;
  maxUsesPerCustomerPerYear: number | null;
  requiresNote: boolean;
  requiresGroupEvent: boolean;
}

export type DiscountRefusal =
  | "DISCOUNT_INACTIVE"
  | "DISCOUNT_NOT_STARTED"
  | "DISCOUNT_EXPIRED"
  | "DISCOUNT_USED_UP"
  | "DISCOUNT_WRONG_LOCATION"
  | "CUSTOMER_REQUIRED"
  | "DISCOUNT_CUSTOMER_LIMIT"
  | "NOTE_REQUIRED"
  | "GROUP_EVENT_REQUIRED";

export const DISCOUNT_REFUSAL_MESSAGES: Record<DiscountRefusal, string> = {
  DISCOUNT_INACTIVE: "That discount isn't active.",
  DISCOUNT_NOT_STARTED: "That discount hasn't started yet.",
  DISCOUNT_EXPIRED: "That discount has ended.",
  DISCOUNT_USED_UP: "That discount has been used the maximum number of times.",
  DISCOUNT_WRONG_LOCATION: "That discount is for a different studio.",
  CUSTOMER_REQUIRED: "This discount is limited per customer. Attach the customer first.",
  DISCOUNT_CUSTOMER_LIMIT: "This customer has already used that discount this year.",
  NOTE_REQUIRED: "This discount needs a note saying why it was given.",
  GROUP_EVENT_REQUIRED: "This discount is only for orders tied to a group event. Pick the group event.",
};

/**
 * The rules every way of applying a discount shares (POS, online checkout).
 * Returns the first reason it can't be used, or null. `customerUsesThisYear`
 * is the customer's redemption count over the last 365 days (null = no customer).
 */
export function checkDiscountUsable(
  discount: DiscountCodeRules,
  args: {
    now: Date;
    locationId: string | null;
    customerUsesThisYear: number | null;
    note?: string | null;
    isGroupEventOrder?: boolean;
  },
): DiscountRefusal | null {
  if (!discount.isActive || discount.archivedAt) return "DISCOUNT_INACTIVE";
  if (discount.validFrom && discount.validFrom > args.now) return "DISCOUNT_NOT_STARTED";
  if (discount.validUntil && discount.validUntil < args.now) return "DISCOUNT_EXPIRED";
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) return "DISCOUNT_USED_UP";
  if (discount.locationId && discount.locationId !== args.locationId) return "DISCOUNT_WRONG_LOCATION";
  if (discount.maxUsesPerCustomerPerYear != null) {
    if (args.customerUsesThisYear == null) return "CUSTOMER_REQUIRED";
    if (args.customerUsesThisYear >= discount.maxUsesPerCustomerPerYear) return "DISCOUNT_CUSTOMER_LIMIT";
  }
  if (discount.requiresNote && !args.note?.trim()) return "NOTE_REQUIRED";
  if (discount.requiresGroupEvent && !args.isGroupEventOrder) return "GROUP_EVENT_REQUIRED";
  return null;
}
