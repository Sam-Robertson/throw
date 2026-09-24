import { describe, expect, it } from "vitest";
import { SMART_TIP_THRESHOLD_CENTS, tipBaseCents, tipOptions } from "./tipping";

describe("tipOptions", () => {
  it("offers 15 / 18 / 20 % of the base on a normal bill", () => {
    expect(tipOptions(4000)).toEqual([
      { amountCents: 600, label: "15%" },
      { amountCents: 720, label: "18%" },
      { amountCents: 800, label: "20%" },
    ]);
  });

  it("rounds percentages to the cent", () => {
    // 15% of $29.99 is $4.4985
    expect(tipOptions(2999)[0].amountCents).toBe(450);
  });

  it("offers whole dollars under the smart-tip threshold", () => {
    expect(tipOptions(SMART_TIP_THRESHOLD_CENTS - 1).map((o) => o.label)).toEqual(["$1", "$2", "$3"]);
    expect(tipOptions(SMART_TIP_THRESHOLD_CENTS).map((o) => o.label)).toEqual(["15%", "18%", "20%"]);
  });
});

describe("tipBaseCents", () => {
  it("is the discounted subtotal, never negative", () => {
    expect(tipBaseCents({ subtotalCents: 5000, discountCents: 1000 })).toBe(4000);
    expect(tipBaseCents({ subtotalCents: 500, discountCents: 900 })).toBe(0);
  });
});
