import type { Prisma } from "@prisma/client";

/**
 * A class type is a checkout option only when it is active and has a real
 * price. The Momence import left dozens of $0 types behind (piece pick-up
 * slots, "Pay for Pottery Pieces", private parties, member-only classes);
 * those are not things a customer or the POS can buy a seat in.
 *
 * Members booking with a class ticket go through /api/bookings, which does
 * not use this — a $0 member class is still bookable on a membership.
 */
export const SELLABLE_SESSION_TYPE = {
  isActive: true,
  dropInPriceCents: { gt: 0 },
} satisfies Prisma.SessionTypeWhereInput;

export function isSellable(sessionType: { isActive: boolean; dropInPriceCents: number }): boolean {
  return sessionType.isActive && sessionType.dropInPriceCents > 0;
}
