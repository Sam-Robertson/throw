// Tip prompts, shared by the card reader (Stripe Terminal's on-reader tipping
// configuration), the POS screen prompt for other tenders, and the tests.
// No Prisma or Stripe imports so client components can use it.

/** Percentage options offered on a bill at or above the smart-tip threshold. */
export const TIP_PERCENTAGES = [15, 18, 20] as const;

/** Whole-dollar options offered on small bills instead of percentages. */
export const TIP_FIXED_CENTS = [100, 200, 300] as const;

/**
 * Below this, percentages give silly amounts (15% of $4 is 60¢), so fixed
 * dollar amounts are offered instead — the same idea as Stripe's smart tips.
 */
export const SMART_TIP_THRESHOLD_CENTS = 1000;

export interface TipOption {
  amountCents: number;
  /** "18%" or "$2". */
  label: string;
}

/**
 * The tip choices to show for a bill of `baseCents` (the pre-tax, post-discount
 * amount being paid). Percentages are of that base, rounded to the cent.
 */
export function tipOptions(baseCents: number): TipOption[] {
  if (baseCents < SMART_TIP_THRESHOLD_CENTS) {
    return TIP_FIXED_CENTS.map((amountCents) => ({ amountCents, label: `$${amountCents / 100}` }));
  }
  return TIP_PERCENTAGES.map((pct) => ({
    amountCents: Math.round((baseCents * pct) / 100),
    label: `${pct}%`,
  }));
}

/**
 * What a tip prompt is based on: the goods and services on the order, after
 * discounts and before tax and any tip already on it.
 */
export function tipBaseCents(order: { subtotalCents: number; discountCents: number }): number {
  return Math.max(0, order.subtotalCents - order.discountCents);
}
