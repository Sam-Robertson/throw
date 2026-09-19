import { describe, expect, it } from "vitest";
import { priceByWeight, quoteMemberFiring, toWeightTenths, type FiringRates } from "./firing";

// Catalog §3.1 values, passed in the way the POS passes the product rows.
const RATES: FiringRates = { standardCentsPerLb: 100, oversizeCentsPerLb: 175, minChargeCents: 100 };

function quote(pieces: { weightLb: number; oversize?: boolean }[], rates = RATES) {
  const result = quoteMemberFiring(
    pieces.map((p) => ({ weightLb: p.weightLb, oversize: p.oversize ?? false })),
    rates,
  );
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe("quoteMemberFiring", () => {
  it("prices a normal piece at the standard rate", () => {
    const result = quote([{ weightLb: 2.4 }]);
    expect(result.totalCents).toBe(240);
    expect(result.lines[0]).toMatchObject({
      weightTenths: 24,
      weightLb: 2.4,
      rateCentsPerLb: 100,
      chargeCents: 240,
      minimumApplied: false,
    });
  });

  it("prices an oversize piece at the oversize rate", () => {
    const result = quote([{ weightLb: 3.0, oversize: true }]);
    expect(result.lines[0].rateCentsPerLb).toBe(175);
    expect(result.totalCents).toBe(525);
  });

  it("applies the per-piece minimum", () => {
    const result = quote([{ weightLb: 0.4 }]);
    expect(result.lines[0]).toMatchObject({ weightChargeCents: 40, chargeCents: 100, minimumApplied: true });
    // An oversize piece under the minimum too: 0.5 lb × $1.75 = $0.88 → $1.00
    expect(quote([{ weightLb: 0.5, oversize: true }]).lines[0]).toMatchObject({
      weightChargeCents: 88,
      chargeCents: 100,
    });
  });

  it("does not apply the minimum at or above it", () => {
    expect(quote([{ weightLb: 1.0 }]).lines[0].minimumApplied).toBe(false);
  });

  it("rounds input finer than 0.1 lb to the nearest tenth, halves up", () => {
    expect(toWeightTenths(1.25)).toBe(13);
    expect(toWeightTenths(1.24)).toBe(12);
    // 1.15 and 2.675 are stored just under the half in binary.
    expect(toWeightTenths(1.15)).toBe(12);
    expect(toWeightTenths(2.675)).toBe(27);
    expect(quote([{ weightLb: 1.25 }]).totalCents).toBe(130);
  });

  it("rounds rate × weight to the cent, halves up", () => {
    // 1.3 lb × $1.75 = $2.275 → $2.28
    expect(quote([{ weightLb: 1.3, oversize: true }]).totalCents).toBe(228);
    // 1.1 lb × $1.75 = $1.925 → $1.93
    expect(quote([{ weightLb: 1.1, oversize: true }]).totalCents).toBe(193);
  });

  it("has no float drift on weights like 0.1 + 0.2", () => {
    expect(quote([{ weightLb: 0.1 + 0.2 }], { ...RATES, minChargeCents: 0 }).totalCents).toBe(30);
  });

  it("charges a positive weight that rounds to zero as 0.1 lb", () => {
    expect(quote([{ weightLb: 0.01 }]).lines[0]).toMatchObject({ weightTenths: 1, chargeCents: 100 });
  });

  it("prices each piece on its own, then sums", () => {
    const result = quote([
      { weightLb: 0.3 }, // minimum: 100
      { weightLb: 0.3 }, // minimum: 100 (one 0.6 lb line would also have been 100)
      { weightLb: 2.0 }, // 200
      { weightLb: 4.2, oversize: true }, // 735
    ]);
    expect(result.lines.map((l) => l.chargeCents)).toEqual([100, 100, 200, 735]);
    expect(result.totalCents).toBe(1135);
    expect(result.totalWeightTenths).toBe(68);
  });

  it("returns nothing to charge for an empty list", () => {
    expect(quote([])).toEqual({ ok: true, lines: [], totalCents: 0, totalWeightTenths: 0 });
  });

  it("uses the rates it is given, not built-in prices", () => {
    const result = quote([{ weightLb: 2 }, { weightLb: 2, oversize: true }], {
      standardCentsPerLb: 125,
      oversizeCentsPerLb: 200,
      minChargeCents: 300,
    });
    expect(result.lines.map((l) => l.chargeCents)).toEqual([300, 400]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 101])("rejects a weight of %s", (weightLb) => {
    const result = quoteMemberFiring([{ weightLb: 1, oversize: false }, { weightLb, oversize: false }], RATES);
    expect(result).toMatchObject({ ok: false, pieceIndex: 1 });
  });

  it("rejects a weight that isn't a number", () => {
    const result = quoteMemberFiring([{ weightLb: "2" as unknown as number, oversize: false }], RATES);
    expect(result.ok).toBe(false);
  });

  it("rejects rates that aren't whole cents", () => {
    expect(quoteMemberFiring([], { ...RATES, standardCentsPerLb: 99.5 }).ok).toBe(false);
    expect(quoteMemberFiring([], { ...RATES, minChargeCents: -1 }).ok).toBe(false);
  });
});

describe("priceByWeight", () => {
  it("prices clay by the pound", () => {
    expect(priceByWeight(12.5, 100, null)).toEqual({ ok: true, weightTenths: 125, weightLb: 12.5, cents: 1250 });
    expect(priceByWeight(2.5, 50, null)).toMatchObject({ cents: 125 });
    expect(priceByWeight(0.5, 300, null)).toMatchObject({ cents: 150 });
  });

  it("applies a minimum when the product has one", () => {
    expect(priceByWeight(0.2, 100, 100)).toMatchObject({ cents: 100 });
  });

  it("rejects a bad weight", () => {
    expect(priceByWeight(0, 100, null)).toEqual({ ok: false, reason: "Enter a weight greater than zero." });
  });
});
