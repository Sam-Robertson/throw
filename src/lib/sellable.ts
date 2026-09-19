import type { Prisma } from "@prisma/client";

/**
 * What a class costs, and whether it can be bought at all.
 *
 * A class type is a checkout option (POS Classes tab, public schedule price,
 * online booking) only when it is active, not archived, public, not
 * members-only, not an internal block, and resolves to a real price at the
 * studio the session is held in. The Momence import left dozens of $0 types
 * behind (piece pick-up slots, private parties, member classes); those are
 * not things a customer or the POS can buy a seat in.
 *
 * Members booking with a class ticket go through /api/bookings, which does
 * not use the price — a $0 member class is still bookable on a membership.
 *
 * Price resolution, most specific first:
 *   1. StudioSession.priceCentsOverride        (workshops priced per session)
 *   2. SessionTypeLocationPrice for the studio  (Provo $29.99, Lehi $35)
 *   3. SessionType.dropInPriceCents             (the default)
 * Member prices follow the same order and fall back to the regular price.
 */

/** Structural half of "sellable". The price half needs {@link resolveClassPriceCents}. */
export const SELLABLE_SESSION_TYPE = {
  isActive: true,
  archivedAt: null,
  isPublic: true,
  membersOnly: false,
  isBusyWindow: false,
} satisfies Prisma.SessionTypeWhereInput;

/** Select this on a SessionType to be able to price it. */
export const CLASS_PRICE_SELECT = {
  id: true,
  isActive: true,
  archivedAt: true,
  isPublic: true,
  membersOnly: true,
  isBusyWindow: true,
  dropInPriceCents: true,
  memberPriceCents: true,
  locationPrices: { select: { locationId: true, priceCents: true, memberPriceCents: true } },
} satisfies Prisma.SessionTypeSelect;

export type PricedSessionType = {
  isActive: boolean;
  archivedAt: Date | null;
  isPublic: boolean;
  membersOnly: boolean;
  isBusyWindow: boolean;
  dropInPriceCents: number;
  memberPriceCents: number | null;
  locationPrices: { locationId: string; priceCents: number; memberPriceCents: number | null }[];
};

export function resolveClassPriceCents(args: {
  sessionType: Pick<PricedSessionType, "dropInPriceCents" | "memberPriceCents" | "locationPrices">;
  locationId: string | null;
  priceCentsOverride?: number | null;
  isMember?: boolean;
}): number {
  const { sessionType, locationId, priceCentsOverride, isMember } = args;
  if (priceCentsOverride != null) return priceCentsOverride;

  const atLocation = locationId
    ? sessionType.locationPrices.find((p) => p.locationId === locationId)
    : undefined;
  const regular = atLocation?.priceCents ?? sessionType.dropInPriceCents;
  if (!isMember) return regular;
  return atLocation?.memberPriceCents ?? sessionType.memberPriceCents ?? regular;
}

/** True when this class type can be sold as a drop-in at `priceCents`. */
export function isSellable(sessionType: Omit<PricedSessionType, "locationPrices" | "dropInPriceCents" | "memberPriceCents">, priceCents: number): boolean {
  return (
    sessionType.isActive &&
    sessionType.archivedAt === null &&
    sessionType.isPublic &&
    !sessionType.membersOnly &&
    !sessionType.isBusyWindow &&
    priceCents > 0
  );
}

/** Shown on the public schedule: hide retired, private and internal types. */
export const PUBLICLY_LISTED_SESSION_TYPE = {
  isActive: true,
  archivedAt: null,
  isPublic: true,
  isBusyWindow: false,
} satisfies Prisma.SessionTypeWhereInput;
