/**
 * When a staff-applied discount needs a written reason. These are policy
 * thresholds, not prices: the discounts themselves live in the catalog.
 *
 * Plain module (no 'use client') so the discounts route enforces the very same
 * object the register's discount picker reads.
 */
export const DISCOUNT_NOTE_POLICY = {
  /** Percent discounts at or above this need a note. */
  percentAtOrAbove: 50,
  /** Fixed discounts at or above this many cents need a note. */
  fixedCentsAtOrAbove: 2000,
} as const;

export const LARGE_DISCOUNT_NOTE_MESSAGE =
  'A discount this large needs a note saying why it was given.';

/** True when a staff-applied discount is large enough that policy wants a reason on record. */
export function isLargeDiscount(discount: { type: string; value: number }): boolean {
  return discount.type === 'percent'
    ? discount.value >= DISCOUNT_NOTE_POLICY.percentAtOrAbove
    : discount.value >= DISCOUNT_NOTE_POLICY.fixedCentsAtOrAbove;
}
