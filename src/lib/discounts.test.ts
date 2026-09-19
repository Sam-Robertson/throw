import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  calculateDiscounts,
  checkDiscountUsable,
  lineMatchesDiscount,
  pickAutomaticDiscounts,
  type AppliedDiscount,
  type DiscountCodeRules,
  type DiscountContext,
  type DiscountLine,
} from "./discounts";

const NO_CONTEXT: DiscountContext = { commitmentMonths: null, isGroupEventOrder: false };

// Lines as the POS builds them.
const mug: DiscountLine = { id: "mug", itemType: "RETAIL", category: "RETAIL", productSlug: "mug", quantity: 1, unitPriceCents: 2400 };
const onePound = (id: string, quantity = 1): DiscountLine => ({
  id,
  itemType: "RETAIL",
  category: "PIECES",
  productSlug: "piece-1lb",
  quantity,
  unitPriceCents: 999,
});
const wheel = (id: string, sessionTypeId = "clay-together"): DiscountLine => ({
  id,
  itemType: "DROP_IN",
  category: null,
  sessionTypeId,
  quantity: 1,
  unitPriceCents: 2999,
});
const giftCard: DiscountLine = { id: "gc", itemType: "GIFT_CARD", category: null, quantity: 1, unitPriceCents: 5000 };
const firing: DiscountLine = { id: "firing", itemType: "RETAIL", category: "FIRING", productSlug: "glaze-firing", quantity: 1, unitPriceCents: 240 };
const clay: DiscountLine = { id: "clay", itemType: "RETAIL", category: "CLAY", productSlug: "clay-b-mix", quantity: 1, unitPriceCents: 1000 };

// The catalog's discounts (§6).
const STAFF10: AppliedDiscount = { id: "staff10", type: "percent", value: 10, scope: "EVERYTHING" };
const COMMIT3: AppliedDiscount = { id: "commit3", type: "percent", value: 10, scope: "RETAIL", automatic: true, autoCommitmentMonths: 3 };
const COMMIT12: AppliedDiscount = { id: "commit12", type: "percent", value: 20, scope: "RETAIL", automatic: true, autoCommitmentMonths: 12 };
const GROUPEXTRAS20: AppliedDiscount = { id: "group", type: "percent", value: 20, scope: "PIECES", requiresGroupEvent: true };
const GETOUTPASS: AppliedDiscount = { id: "pass", type: "percent", value: 100, scope: "PIECES", productSlug: "piece-1lb", maxUnits: 1 };
const FREEWHEEL: AppliedDiscount = { id: "freewheel", type: "percent", value: 100, scope: "CLASSES", sessionTypeId: "clay-together", maxUnits: 1 };

describe("calculateDiscounts: catalog scenarios", () => {
  it("12 month member buying retail and a piece: only retail gets 20%", () => {
    const result = calculateDiscounts([mug, onePound("piece"), firing, clay], [COMMIT12], {
      commitmentMonths: 12,
      isGroupEventOrder: false,
    });
    expect(result.discountAmounts.commit12).toBe(480);
    expect(result.lines.mug).toMatchObject({ discountCents: 480, totalCents: 1920 });
    expect(result.lines.piece).toMatchObject({ discountCents: 0, totalCents: 999 });
    expect(result.lines.firing.discountCents).toBe(0);
    expect(result.lines.clay.discountCents).toBe(0);
    expect(result.totalDiscountCents).toBe(480);
  });

  it("a commitment discount does nothing without the commitment", () => {
    expect(calculateDiscounts([mug], [COMMIT12], NO_CONTEXT).totalDiscountCents).toBe(0);
    expect(calculateDiscounts([mug], [COMMIT12], { commitmentMonths: 3, isGroupEventOrder: false }).totalDiscountCents).toBe(0);
    expect(calculateDiscounts([mug], [COMMIT3], { commitmentMonths: 3, isGroupEventOrder: false }).totalDiscountCents).toBe(240);
  });

  it("Get Out Pass with two 1 lb pieces: one is free", () => {
    const asOneLine = calculateDiscounts([onePound("pieces", 2)], [GETOUTPASS], NO_CONTEXT);
    expect(asOneLine.lines.pieces).toMatchObject({ grossCents: 1998, discountCents: 999, totalCents: 999 });

    const asTwoLines = calculateDiscounts([onePound("a"), onePound("b")], [GETOUTPASS], NO_CONTEXT);
    expect(asTwoLines.lines.a.totalCents).toBe(0);
    expect(asTwoLines.lines.b.totalCents).toBe(999);
    expect(asTwoLines.discountAmounts.pass).toBe(999);
  });

  it("Get Out Pass never frees a 2 lb piece or the wheel", () => {
    const twoPound: DiscountLine = { ...onePound("two"), productSlug: "piece-2lb", unitPriceCents: 1499 };
    const result = calculateDiscounts([twoPound, wheel("w")], [GETOUTPASS], NO_CONTEXT);
    expect(result.totalDiscountCents).toBe(0);
  });

  it("FREEWHEEL on a two-wheel order frees one wheel", () => {
    const result = calculateDiscounts([wheel("w1"), wheel("w2")], [FREEWHEEL], NO_CONTEXT);
    expect(result.discountAmounts.freewheel).toBe(2999);
    expect(result.lines.w1.totalCents).toBe(0);
    expect(result.lines.w2.totalCents).toBe(2999);

    const oneLineTwoWheels = calculateDiscounts([{ ...wheel("w"), quantity: 2 }], [FREEWHEEL], NO_CONTEXT);
    expect(oneLineTwoWheels.lines.w.totalCents).toBe(2999);
  });

  it("FREEWHEEL doesn't touch another class type", () => {
    const result = calculateDiscounts([wheel("k", "kickstart")], [FREEWHEEL], NO_CONTEXT);
    expect(result.totalDiscountCents).toBe(0);
  });

  it("staff 10% on everything, except gift cards", () => {
    const result = calculateDiscounts([mug, onePound("piece"), wheel("w"), firing, clay, giftCard], [STAFF10], NO_CONTEXT);
    expect(result.lines.mug.discountCents).toBe(240);
    expect(result.lines.piece.discountCents).toBe(100);
    expect(result.lines.w.discountCents).toBe(300);
    expect(result.lines.firing.discountCents).toBe(24);
    expect(result.lines.clay.discountCents).toBe(100);
    expect(result.lines.gc).toMatchObject({ discountCents: 0, totalCents: 5000 });
    expect(result.discountAmounts.staff10).toBe(764);
  });

  it("a fixed-amount code larger than the line takes the line to zero, not below", () => {
    const code: AppliedDiscount = { id: "fifty", type: "fixed_cents", value: 5000, scope: "CLASSES" };
    const result = calculateDiscounts([wheel("w"), mug], [code], NO_CONTEXT);
    expect(result.discountAmounts.fifty).toBe(2999);
    expect(result.lines.w.totalCents).toBe(0);
    expect(result.lines.mug.totalCents).toBe(2400);
  });

  it("group event extras only on a group event order, and only on pieces", () => {
    expect(calculateDiscounts([onePound("p")], [GROUPEXTRAS20], NO_CONTEXT).totalDiscountCents).toBe(0);
    const result = calculateDiscounts([onePound("p"), mug], [GROUPEXTRAS20], { commitmentMonths: null, isGroupEventOrder: true });
    expect(result.lines.p.discountCents).toBe(200);
    expect(result.lines.mug.discountCents).toBe(0);
  });
});

describe("calculateDiscounts: mechanics", () => {
  it("spreads a fixed amount across eligible lines in proportion, to the cent", () => {
    const code: AppliedDiscount = { id: "ten", type: "fixed_cents", value: 1000, scope: "EVERYTHING" };
    const result = calculateDiscounts([mug, onePound("piece")], [code], NO_CONTEXT);
    expect(result.lines.mug.discountCents + result.lines.piece.discountCents).toBe(1000);
    expect(result.lines.mug.discountCents).toBe(706);
    expect(result.lines.piece.discountCents).toBe(294);
  });

  it("stacks on what is left: automatic, then percent, then fixed", () => {
    const fixed: AppliedDiscount = { id: "fixed", type: "fixed_cents", value: 500, scope: "EVERYTHING" };
    // Passed in the "wrong" order on purpose.
    const result = calculateDiscounts([mug], [fixed, STAFF10, COMMIT12], { commitmentMonths: 12, isGroupEventOrder: false });
    expect(result.lines.mug.byDiscount).toEqual({ commit12: 480, staff10: 192, fixed: 500 });
    expect(result.lines.mug.totalCents).toBe(2400 - 480 - 192 - 500);
  });

  it("is deterministic whatever order discounts are passed in", () => {
    const a: AppliedDiscount = { ...STAFF10, id: "a", appliedAt: new Date("2026-09-19T10:00:00Z") };
    const b: AppliedDiscount = { id: "b", type: "percent", value: 100, scope: "PIECES", maxUnits: 1, appliedAt: new Date("2026-09-19T10:05:00Z") };
    const lines = [onePound("p", 3)];
    expect(calculateDiscounts(lines, [a, b], NO_CONTEXT)).toEqual(calculateDiscounts(lines, [b, a], NO_CONTEXT));
  });

  it("takes the manual line discount off first, and named discounts off the rest", () => {
    const result = calculateDiscounts([{ ...mug, manualDiscountCents: 400 }], [STAFF10], NO_CONTEXT);
    expect(result.lines.mug).toMatchObject({ manualDiscountCents: 400, byDiscount: { staff10: 200 }, discountCents: 600, totalCents: 1800 });
    // The named discount's own amount excludes the manual part.
    expect(result.discountAmounts.staff10).toBe(200);
  });

  it("never discounts a line below zero", () => {
    const hundred: AppliedDiscount = { id: "free", type: "percent", value: 100, scope: "EVERYTHING" };
    const result = calculateDiscounts([{ ...mug, manualDiscountCents: 9999 }, onePound("p")], [hundred, STAFF10, { id: "f", type: "fixed_cents", value: 100, scope: "EVERYTHING" }], NO_CONTEXT);
    expect(result.lines.mug).toMatchObject({ manualDiscountCents: 2400, totalCents: 0 });
    expect(result.lines.p.totalCents).toBe(0);
    expect(result.discountAmounts).toEqual({ free: 999, staff10: 0, f: 0 });
  });

  it("discounts the dearest units first under maxUnits", () => {
    const cheap: DiscountLine = { id: "cheap", itemType: "RETAIL", category: "PIECES", quantity: 1, unitPriceCents: 999 };
    const dear: DiscountLine = { id: "dear", itemType: "RETAIL", category: "PIECES", quantity: 1, unitPriceCents: 1499 };
    const oneFree: AppliedDiscount = { id: "one", type: "percent", value: 100, scope: "PIECES", maxUnits: 1 };
    const result = calculateDiscounts([cheap, dear], [oneFree], NO_CONTEXT);
    expect(result.lines.dear.totalCents).toBe(0);
    expect(result.lines.cheap.totalCents).toBe(999);
  });

  it("two one-piece passes free two pieces, not one piece twice", () => {
    const second: AppliedDiscount = { ...GETOUTPASS, id: "pass2" };
    const result = calculateDiscounts([onePound("p", 3)], [GETOUTPASS, second], NO_CONTEXT);
    expect(result.lines.p.totalCents).toBe(999);
  });

  it("returns a zero amount for a discount nothing qualified for", () => {
    const result = calculateDiscounts([giftCard], [STAFF10], NO_CONTEXT);
    expect(result.discountAmounts).toEqual({ staff10: 0 });
    expect(calculateDiscounts([], [STAFF10], NO_CONTEXT).totalDiscountCents).toBe(0);
  });
});

describe("lineMatchesDiscount", () => {
  const retailScope: AppliedDiscount = { id: "r", type: "percent", value: 10, scope: "RETAIL" };

  it("RETAIL scope never touches pieces, firing, clay, packs, shipping, gift cards or custom lines", () => {
    for (const category of ["PIECES", "FIRING", "CLAY", "CLASS_PACK", "SHIPPING"]) {
      expect(lineMatchesDiscount({ ...mug, category }, retailScope)).toBe(false);
    }
    expect(lineMatchesDiscount(giftCard, retailScope)).toBe(false);
    expect(lineMatchesDiscount({ id: "c", itemType: "CUSTOM", category: null, quantity: 1, unitPriceCents: 500 }, retailScope)).toBe(false);
    expect(lineMatchesDiscount(wheel("w"), retailScope)).toBe(false);
  });

  it("treats a RETAIL line with no category as retail", () => {
    expect(lineMatchesDiscount({ ...mug, category: null }, retailScope)).toBe(true);
  });

  it("CLASSES scope respects sessionTypeId when set", () => {
    const anyClass: AppliedDiscount = { id: "c", type: "percent", value: 30, scope: "CLASSES" };
    expect(lineMatchesDiscount(wheel("w", "kickstart"), anyClass)).toBe(true);
    expect(lineMatchesDiscount(wheel("w", "kickstart"), { ...anyClass, sessionTypeId: "kickstart" })).toBe(true);
    expect(lineMatchesDiscount(wheel("w", "clay-together"), { ...anyClass, sessionTypeId: "kickstart" })).toBe(false);
    expect(lineMatchesDiscount(mug, anyClass)).toBe(false);
  });

  it("never matches a membership line", () => {
    expect(lineMatchesDiscount({ id: "m", itemType: "MEMBERSHIP", category: null, quantity: 1, unitPriceCents: 7000 }, STAFF10)).toBe(false);
  });
});

describe("pickAutomaticDiscounts", () => {
  const candidates = [
    { id: "commit3", autoCommitmentMonths: 3 },
    { id: "commit12", autoCommitmentMonths: 12 },
  ];

  it("picks the single longest commitment the member qualifies for", () => {
    expect(pickAutomaticDiscounts(candidates, 12).map((d) => d.id)).toEqual(["commit12"]);
    expect(pickAutomaticDiscounts(candidates, 3).map((d) => d.id)).toEqual(["commit3"]);
    expect(pickAutomaticDiscounts(candidates, 6).map((d) => d.id)).toEqual(["commit3"]);
  });

  it("picks nothing without a commitment", () => {
    expect(pickAutomaticDiscounts(candidates, null)).toEqual([]);
    expect(pickAutomaticDiscounts(candidates, 1)).toEqual([]);
  });
});

describe("allocateProportionally", () => {
  it("sums exactly and never exceeds a weight", () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(5, [5, 0, 0])).toEqual([5, 0, 0]);
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
  });
});

describe("checkDiscountUsable", () => {
  const now = new Date("2026-09-19T18:00:00Z");
  const base: DiscountCodeRules = {
    code: "KICKSTART50",
    isActive: true,
    archivedAt: null,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
    locationId: null,
    maxUsesPerCustomerPerYear: null,
    requiresNote: false,
    requiresGroupEvent: false,
  };
  const args = { now, locationId: "provo", customerUsesThisYear: null };

  it("accepts a plain active code", () => {
    expect(checkDiscountUsable(base, args)).toBeNull();
  });

  it("refuses inactive, archived, early, late, used up and wrong-studio codes", () => {
    expect(checkDiscountUsable({ ...base, isActive: false }, args)).toBe("DISCOUNT_INACTIVE");
    expect(checkDiscountUsable({ ...base, archivedAt: now }, args)).toBe("DISCOUNT_INACTIVE");
    expect(checkDiscountUsable({ ...base, validFrom: new Date("2026-10-01") }, args)).toBe("DISCOUNT_NOT_STARTED");
    expect(checkDiscountUsable({ ...base, validUntil: new Date("2026-09-01") }, args)).toBe("DISCOUNT_EXPIRED");
    expect(checkDiscountUsable({ ...base, maxUses: 5, usedCount: 5 }, args)).toBe("DISCOUNT_USED_UP");
    expect(checkDiscountUsable({ ...base, locationId: "lehi" }, args)).toBe("DISCOUNT_WRONG_LOCATION");
  });

  it("enforces the per-customer yearly limit, which needs a customer", () => {
    const pass = { ...base, maxUsesPerCustomerPerYear: 1 };
    expect(checkDiscountUsable(pass, args)).toBe("CUSTOMER_REQUIRED");
    expect(checkDiscountUsable(pass, { ...args, customerUsesThisYear: 0 })).toBeNull();
    expect(checkDiscountUsable(pass, { ...args, customerUsesThisYear: 1 })).toBe("DISCOUNT_CUSTOMER_LIMIT");
  });

  it("enforces the note and the group event", () => {
    expect(checkDiscountUsable({ ...base, requiresNote: true }, { ...args, note: "  " })).toBe("NOTE_REQUIRED");
    expect(checkDiscountUsable({ ...base, requiresNote: true }, { ...args, note: "Yelp coupon" })).toBeNull();
    expect(checkDiscountUsable({ ...base, requiresGroupEvent: true }, args)).toBe("GROUP_EVENT_REQUIRED");
    expect(checkDiscountUsable({ ...base, requiresGroupEvent: true }, { ...args, isGroupEventOrder: true })).toBeNull();
  });
});
