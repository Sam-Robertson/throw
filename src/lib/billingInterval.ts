// Pure helpers (no prisma), so client components can import them too.

export interface BillingInterval {
  unit: "day" | "week" | "month" | "year";
  count: number;
}

/**
 * MembershipPlan.billingIntervalDays as a calendar interval: 30 is a month,
 * 365 a year, 90 three months. Anything else bills every N weeks or days.
 * The Stripe Price and every "/month" label come from this one mapping.
 */
export function billingIntervalFromDays(billingIntervalDays: number): BillingInterval {
  if (billingIntervalDays % 365 === 0) return { unit: "year", count: billingIntervalDays / 365 };
  if (billingIntervalDays % 30 === 0) return { unit: "month", count: billingIntervalDays / 30 };
  if (billingIntervalDays % 7 === 0) return { unit: "week", count: billingIntervalDays / 7 };
  return { unit: "day", count: billingIntervalDays };
}

/** "month", "year", "3 months", "4 weeks". */
export function billingPeriodLabel(billingIntervalDays: number): string {
  const { unit, count } = billingIntervalFromDays(billingIntervalDays);
  return count === 1 ? unit : `${count} ${unit}s`;
}
