/**
 * Member glaze firing, priced per piece by weight (docs/throw-catalog.md §3.1).
 *
 * The catalog's rule: exact weight to 0.1 lb, rate × weight rounded to the
 * cent, then the per-piece minimum.
 *
 * Pure: no prices live here. The two rates and the minimum come from the
 * "Glaze firing" and "Glaze firing, oversize" product rows (priceCents and
 * minChargeCents), so changing a price in admin changes the calculator.
 *
 * No float drift: a weight becomes an integer number of tenths of a pound
 * before any money maths, and money is integer cents throughout.
 *
 * Input finer than 0.1 lb (a scale that reads 1.25) is rounded to the nearest
 * tenth, halves up: 1.25 → 1.3, 1.24 → 1.2. The weight is first snapped to
 * hundredths so binary noise can't flip a half (1.15 is stored as 1.1499…, and
 * still rounds to 1.2). Anything that would round to 0.0 is charged as 0.1 lb.
 */

export interface FiringPieceInput {
  weightLb: number;
  /** Over 12 in at the widest point: charged at the oversize rate. */
  oversize: boolean;
}

export interface FiringRates {
  /** Glaze firing, cents per lb. */
  standardCentsPerLb: number;
  /** Glaze firing over 12 in, cents per lb. */
  oversizeCentsPerLb: number;
  /** Minimum charge per piece, in cents. */
  minChargeCents: number;
}

export interface FiringLine {
  /** Index of the piece in the input list. */
  index: number;
  /** Weight actually charged, in tenths of a pound (13 = 1.3 lb). */
  weightTenths: number;
  /** The same weight in pounds, for display and storage. */
  weightLb: number;
  oversize: boolean;
  rateCentsPerLb: number;
  /** rate × weight rounded to the cent, before the minimum. */
  weightChargeCents: number;
  /** What the piece costs: the larger of weightChargeCents and the minimum. */
  chargeCents: number;
  minimumApplied: boolean;
}

export type FiringQuoteResult =
  | { ok: true; lines: FiringLine[]; totalCents: number; totalWeightTenths: number }
  | { ok: false; reason: string; pieceIndex: number | null };

/** A single piece heavier than this is a typo, not a pot. */
export const MAX_PIECE_WEIGHT_LB = 100;

/** Pounds → integer tenths of a pound, halves up. See the header for why hundredths come first. */
export function toWeightTenths(weightLb: number): number {
  const hundredths = Math.round(weightLb * 100);
  return Math.max(1, Math.floor((hundredths + 5) / 10));
}

function isCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function quoteMemberFiring(pieces: FiringPieceInput[], rates: FiringRates): FiringQuoteResult {
  if (
    !isCents(rates.standardCentsPerLb) ||
    !isCents(rates.oversizeCentsPerLb) ||
    !isCents(rates.minChargeCents)
  ) {
    return { ok: false, reason: "Firing rates must be whole cents.", pieceIndex: null };
  }

  const lines: FiringLine[] = [];
  for (const [index, piece] of pieces.entries()) {
    const weightLb = piece?.weightLb;
    if (typeof weightLb !== "number" || !Number.isFinite(weightLb) || weightLb <= 0) {
      return { ok: false, reason: `Piece ${index + 1}: enter a weight greater than zero.`, pieceIndex: index };
    }
    if (weightLb > MAX_PIECE_WEIGHT_LB) {
      return {
        ok: false,
        reason: `Piece ${index + 1}: ${weightLb} lb is over the ${MAX_PIECE_WEIGHT_LB} lb limit. Check the weight.`,
        pieceIndex: index,
      };
    }

    const oversize = piece.oversize === true;
    const weightTenths = toWeightTenths(weightLb);
    const rateCentsPerLb = oversize ? rates.oversizeCentsPerLb : rates.standardCentsPerLb;
    // rate × tenths is in tenths of a cent; +5 then floor rounds halves up.
    const weightChargeCents = Math.floor((rateCentsPerLb * weightTenths + 5) / 10);
    const chargeCents = Math.max(weightChargeCents, rates.minChargeCents);

    lines.push({
      index,
      weightTenths,
      weightLb: weightTenths / 10,
      oversize,
      rateCentsPerLb,
      weightChargeCents,
      chargeCents,
      minimumApplied: chargeCents > weightChargeCents,
    });
  }

  return {
    ok: true,
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.chargeCents, 0),
    totalWeightTenths: lines.reduce((sum, l) => sum + l.weightTenths, 0),
  };
}

/**
 * A by-weight product (clay, extra clay) sold as one line: price per lb ×
 * weight to 0.1 lb, rounded to the cent, then the product's minimum if it has
 * one. Same rounding as firing, so the register never disagrees with itself.
 */
export function priceByWeight(
  weightLb: number,
  centsPerLb: number,
  minChargeCents: number | null,
): { ok: true; weightTenths: number; weightLb: number; cents: number } | { ok: false; reason: string } {
  const quote = quoteMemberFiring([{ weightLb, oversize: false }], {
    standardCentsPerLb: centsPerLb,
    oversizeCentsPerLb: centsPerLb,
    minChargeCents: minChargeCents ?? 0,
  });
  if (!quote.ok) return { ok: false, reason: quote.reason.replace(/^Piece 1: (\w)/, (_, c: string) => c.toUpperCase()) };
  const [line] = quote.lines;
  return { ok: true, weightTenths: line.weightTenths, weightLb: line.weightLb, cents: line.chargeCents };
}

export function formatWeightLb(weightTenths: number): string {
  return `${(weightTenths / 10).toFixed(1)} lb`;
}
