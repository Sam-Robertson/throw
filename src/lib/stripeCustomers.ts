import { prisma } from "@/lib/prisma";
import { isStripeMissing, type StripeAccount } from "@/lib/stripeAccounts";

/**
 * Stripe Customers across two accounts.
 *
 * A Customer (cus_...) exists in one Stripe account only, so a user who has
 * bought at Provo and then subscribes at Lehi needs a second Customer, in
 * Lehi's account. User.stripeCustomerId holds the default account's Customer
 * (Provo's, in production); a Customer in another account is only remembered
 * on the Membership it was created for (the webhook writes
 * Membership.stripeCustomerId). Either way, the id is checked against the
 * account before use, so an id made with the sandbox key or in the other
 * account is simply not used.
 */

async function visibleIn(account: StripeAccount, customerId: string): Promise<boolean> {
  try {
    const customer = await account.client.customers.retrieve(customerId);
    return !("deleted" in customer && customer.deleted);
  } catch (err) {
    if (isStripeMissing(err)) return false;
    throw err;
  }
}

/** The user's Customer in this account, or null if they have none there yet. */
export async function findStripeCustomerId(
  account: StripeAccount,
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
      memberships: {
        where: { stripeCustomerId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { stripeCustomerId: true },
      },
    },
  });
  if (!user) return null;

  const candidates = [...new Set([user.stripeCustomerId, ...user.memberships.map((m) => m.stripeCustomerId)])].filter(
    (id): id is string => Boolean(id),
  );
  for (const id of candidates) {
    if (await visibleIn(account, id)) return id;
  }
  return null;
}

/** The user's Customer in this account, created if they have none there. */
export async function ensureStripeCustomerId(
  account: StripeAccount,
  userId: string,
): Promise<string> {
  const existing = await findStripeCustomerId(account, userId);
  if (existing) return existing;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });
  const customer = await account.client.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  // The default account's Customer lives on the user (replacing a stale id
  // the account can't see, such as one made in the sandbox). Another
  // account's Customer is kept on the membership by the webhook.
  if (account.isDefault) {
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  }
  return customer.id;
}
