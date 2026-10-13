import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  configuredStripeAccounts,
  defaultStripeAccount,
  isStripeMissing,
  stripeAccountForStudio,
  type StripeAccount,
} from "@/lib/stripeAccounts";

export type { StripeAccount };
export { configuredStripeAccounts, defaultStripeAccount, isStripeMissing, stripeAccountForStudio };

/**
 * The default account's client. Scripts use it; app code should go through
 * stripeForLocation so Lehi's money lands in Lehi's account (see
 * src/lib/stripeAccounts.ts for how the keys are configured).
 */
export const stripe = defaultStripeAccount().client;

/** A location id, a loaded location, or nothing (→ the default account). */
export type LocationRef = string | { name: string } | null | undefined;

/** The Stripe account a studio's money goes to. */
export async function stripeForLocation(location: LocationRef): Promise<StripeAccount> {
  if (!location) return defaultStripeAccount();
  if (typeof location !== "string") return stripeAccountForStudio(location.name);
  const row = await prisma.location.findUnique({ where: { id: location }, select: { name: true } });
  return stripeAccountForStudio(row?.name);
}

/**
 * The account a membership bills through: the membership's studio, else its
 * plan's, else the default (Sam's rule: memberships default to Provo).
 */
export async function stripeForMembership(membership: {
  locationId: string | null;
  plan?: { locationId: string | null } | null;
}): Promise<StripeAccount> {
  return stripeForLocation(membership.locationId ?? membership.plan?.locationId ?? null);
}

/**
 * Finds the account a Checkout Session belongs to from its id alone (the
 * success page only has the id from the URL). Null when no account knows it.
 */
export async function retrieveCheckoutSessionAnyAccount(
  sessionId: string,
): Promise<{ session: Stripe.Checkout.Session; account: StripeAccount } | null> {
  for (const account of configuredStripeAccounts()) {
    try {
      const session = await account.client.checkout.sessions.retrieve(sessionId);
      return { session, account };
    } catch (err) {
      if (!isStripeMissing(err)) throw err;
    }
  }
  return null;
}
