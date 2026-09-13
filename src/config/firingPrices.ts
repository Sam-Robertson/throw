/**
 * Clay & firing prices for the POS "Clay & firing" tab.
 *
 * Sources: the live website (membership FAQ "Weigh and Pay"), JP's June notes,
 * and the Momence product catalog export. EVERY value below needs JP's
 * confirmation before it's relied on — see the FLAG comments.
 *
 * All money is integer cents; all weights are integer ounces.
 */

export type FiringTier = "MEMBER_SMALL" | "MEMBER_LARGE" | "EXPERIENCE" | "COURSE" | "CLAY";

export const FIRING_TIERS: { id: FiringTier; label: string; weightLabel: string }[] = [
  { id: "MEMBER_SMALL", label: "Member firing, under 12 in", weightLabel: "Total weight" },
  { id: "MEMBER_LARGE", label: "Member firing, over 12 in", weightLabel: "Total weight" },
  { id: "EXPERIENCE", label: "Experience piece (flat per piece)", weightLabel: "Weight per piece" },
  { id: "COURSE", label: "Course student (Kickstart)", weightLabel: "Total weight" },
  { id: "CLAY", label: "Recycled clay (purchase)", weightLabel: "Bag size" },
];

/**
 * Members, glaze firing by weight ("Weigh and Pay").
 * FLAG: confirm rates with JP. Matches the membership FAQ and JP's June notes.
 */
export const MEMBER_RATE_CENTS_PER_LB: Record<"MEMBER_SMALL" | "MEMBER_LARGE", number> = {
  MEMBER_SMALL: 100, // pieces under 12 inches: $1.00 / lb
  MEMBER_LARGE: 175, // pieces over 12 inches:  $1.75 / lb
};

/**
 * Experience customers, flat price per finished piece by weight band (live
 * Momence products). Bands are "up to and including" maxOz.
 * FLAG: nothing is defined over 2 lb — the calculator refuses those and asks
 * for a manual price on the Custom tab until JP sets one.
 */
export const EXPERIENCE_BANDS: { maxOz: number; cents: number; label: string }[] = [
  { maxOz: 16, cents: 999, label: "up to 1 lb" },
  { maxOz: 24, cents: 1299, label: "up to 1.5 lb" },
  { maxOz: 32, cents: 1499, label: "up to 2 lb" },
];

/**
 * Course students (Kickstart): clay, glaze and firing included up to 15 lb
 * total, so no charge.
 * FLAG: the allowance is for the whole course, but nothing tracks a student's
 * running total — this only checks the weight entered for this weigh-in. What
 * to charge past 15 lb is not defined.
 */
export const COURSE_ALLOWANCE_OZ = 15 * 16;

/**
 * Recycled clay purchase.
 * FLAG: placeholder. Momence had "Recycled Clay" at $0.50 / lb in these bag
 * sizes, but that product is marked deleted in the export. Confirm with JP.
 */
export const CLAY_CENTS_PER_LB = 50;
export const CLAY_BAG_SIZES_LB = [1, 5, 10, 15, 25];

export interface FiringInput {
  tier: FiringTier;
  /** Total weight (member/course), weight per piece (experience), or bag size (clay). */
  weightOz: number;
  /** Number of pieces (experience: each priced; member/course: for the record) or bags (clay). */
  count: number;
}

export type FiringQuote =
  | { ok: true; totalCents: number; name: string }
  | { ok: false; reason: string };

export function formatWeightOz(oz: number): string {
  const lb = Math.floor(oz / 16);
  const rem = oz % 16;
  if (lb === 0) return `${rem} oz`;
  return rem === 0 ? `${lb} lb` : `${lb} lb ${rem} oz`;
}

export function quoteFiring({ tier, weightOz, count }: FiringInput): FiringQuote {
  if (!Number.isInteger(weightOz) || weightOz <= 0) {
    return { ok: false, reason: "Enter a weight greater than zero." };
  }
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, reason: "Count must be at least 1." };
  }

  switch (tier) {
    case "MEMBER_SMALL":
    case "MEMBER_LARGE": {
      // FLAG: rounding rule isn't documented. Exact cents from ounces, rounded
      // to the nearest cent (e.g. 1 lb 3 oz at $1.00/lb = $1.19).
      const totalCents = Math.round((weightOz * MEMBER_RATE_CENTS_PER_LB[tier]) / 16);
      const size = tier === "MEMBER_SMALL" ? "under 12 in" : "over 12 in";
      const pieces = count === 1 ? "1 piece" : `${count} pieces`;
      return {
        ok: true,
        totalCents,
        name: `Glaze firing (member, ${size}), ${formatWeightOz(weightOz)}, ${pieces}`,
      };
    }
    case "EXPERIENCE": {
      const band = EXPERIENCE_BANDS.find((b) => weightOz <= b.maxOz);
      if (!band) {
        return {
          ok: false,
          reason:
            "Pieces over 2 lb don't have a price yet. Add this on the Custom tab with a manual price and let JP know.",
        };
      }
      return {
        ok: true,
        totalCents: band.cents * count,
        name: `Finished piece firing × ${count} (${band.label} each)`,
      };
    }
    case "COURSE": {
      if (weightOz > COURSE_ALLOWANCE_OZ) {
        return {
          ok: false,
          reason:
            "That's over the 15 lb course allowance, and there's no price for the overage yet. Add it on the Custom tab with a manual price.",
        };
      }
      return {
        ok: true,
        totalCents: 0,
        name: `Course firing (included), ${formatWeightOz(weightOz)}`,
      };
    }
    case "CLAY": {
      const lb = weightOz / 16;
      if (!CLAY_BAG_SIZES_LB.includes(lb)) {
        return { ok: false, reason: `Clay comes in ${CLAY_BAG_SIZES_LB.join(", ")} lb bags.` };
      }
      return {
        ok: true,
        totalCents: lb * CLAY_CENTS_PER_LB * count,
        name: `Recycled clay, ${lb} lb bag × ${count}`,
      };
    }
  }
}

/** Metadata stored on the CUSTOM PosOrderItem a firing/clay line creates. */
export interface FiringMetadata {
  kind: "FIRING";
  tier: FiringTier;
  weightOz: number;
  count: number;
  /** INTAKE pieces this charge covers; written back to the Piece rows on completion. */
  pieceIds?: string[];
}

const TIER_IDS = new Set<string>(FIRING_TIERS.map((t) => t.id));

/** Validates untrusted metadata (request bodies, stored JSON). Null if it isn't a firing line. */
export function parseFiringMetadata(value: unknown): FiringMetadata | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== "FIRING") return null;
  if (typeof v.tier !== "string" || !TIER_IDS.has(v.tier)) return null;
  if (typeof v.weightOz !== "number" || typeof v.count !== "number") return null;

  let pieceIds: string[] | undefined;
  if (v.pieceIds !== undefined) {
    if (!Array.isArray(v.pieceIds) || !v.pieceIds.every((p) => typeof p === "string")) return null;
    pieceIds = (v.pieceIds as string[]).slice(0, 20);
  }

  return {
    kind: "FIRING",
    tier: v.tier as FiringTier,
    weightOz: v.weightOz,
    count: v.count,
    ...(pieceIds && pieceIds.length > 0 ? { pieceIds } : {}),
  };
}
