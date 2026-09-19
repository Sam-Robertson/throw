import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { billingIntervalFromDays, type BillingInterval } from "@/lib/billingInterval";

/**
 * Stripe Products and Prices for membership plans.
 *
 * A Stripe Price is immutable: its amount and interval can never be edited.
 * So a plan whose price changes gets a NEW Price, the plan row points at it,
 * and the old Price is archived (active: false). Archiving only stops new
 * checkouts from using it — subscriptions already on the old Price keep
 * billing at the old amount, and nothing here ever touches a subscription.
 *
 * Re-runs never create duplicates:
 *   - the Product id is derived from the plan id
 *   - the Price carries a lookup_key derived from plan id + amount + interval,
 *     so the same plan at the same price always resolves to the same Price
 *     (an archived one is reactivated instead of being created again).
 *
 * Test and live mode. Production runs a live key; local .env files hold a test
 * key and may point at a copy of production data. A price id made with one
 * key is invisible to the other, so:
 *   - a live key that can't see the stored id replaces it (self-healing)
 *   - a test key that can't see the stored id uses its own test Price for
 *     this call but leaves the stored id alone, so a test id never overwrites
 *     a live one.
 * This is also why scripts never create Prices: they are made lazily here, at
 * checkout time, with whichever key the running app has.
 */

const PLACEHOLDER_PREFIX = "price_placeholder_";
const CURRENCY = "usd";

/** Seed data uses `price_placeholder_*` ids. They are not Stripe objects. */
export function isPlaceholderPriceId(stripePriceId: string | null): boolean {
  return stripePriceId === null || stripePriceId.startsWith(PLACEHOLDER_PREFIX);
}

function isLiveMode(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

function isMissing(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
}

function productIdForPlan(planId: string): string {
  return `throw_plan_${planId}`;
}

function lookupKeyForPlan(planId: string, amountCents: number, interval: BillingInterval): string {
  return `throw_plan_${planId}_${amountCents}_${interval.count}${interval.unit}`;
}

function priceMatches(price: Stripe.Price, amountCents: number, interval: BillingInterval): boolean {
  return (
    price.unit_amount === amountCents &&
    price.currency === CURRENCY &&
    price.recurring?.interval === interval.unit &&
    price.recurring.interval_count === interval.count
  );
}

async function retrievePrice(stripePriceId: string): Promise<Stripe.Price | null> {
  try {
    return await stripe.prices.retrieve(stripePriceId);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

async function ensureProduct(plan: { id: string; name: string; slug: string }): Promise<string> {
  const productId = productIdForPlan(plan.id);
  try {
    const product = await stripe.products.retrieve(productId);
    if (product.name !== plan.name || !product.active) {
      await stripe.products.update(productId, { name: plan.name, active: true });
    }
    return productId;
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
  await stripe.products.create(
    {
      id: productId,
      name: plan.name,
      metadata: { membershipPlanId: plan.id, membershipPlanSlug: plan.slug },
    },
    { idempotencyKey: `create_${productId}` },
  );
  return productId;
}

export interface EnsuredPrice {
  stripePriceId: string;
  /** True when a new Stripe Price was created by this call. */
  created: boolean;
  /** The Price that was archived because the plan's amount or interval changed. */
  archivedPriceId: string | null;
}

/**
 * Returns a recurring Stripe Price that matches the plan's current price and
 * billing interval, creating one (and archiving the outdated one) if needed.
 * Safe to call on every checkout: when the stored Price already matches, this
 * is one Stripe read and no writes.
 */
export async function ensureStripePriceForPlan(planId: string): Promise<EnsuredPrice> {
  const plan = await prisma.membershipPlan.findUniqueOrThrow({
    where: { id: planId },
    select: { id: true, name: true, slug: true, price: true, billingIntervalDays: true, stripePriceId: true },
  });
  if (plan.price <= 0) throw new Error(`Plan "${plan.name}" has no price, so it can't be billed`);

  const interval = billingIntervalFromDays(plan.billingIntervalDays);

  const stored = isPlaceholderPriceId(plan.stripePriceId)
    ? null
    : await retrievePrice(plan.stripePriceId!);
  if (stored && stored.active && priceMatches(stored, plan.price, interval)) {
    return { stripePriceId: stored.id, created: false, archivedPriceId: null };
  }

  // The stored id belongs to the other Stripe mode when this key can't see it.
  const storedIsForeign = !isPlaceholderPriceId(plan.stripePriceId) && stored === null;
  const mayStore = !storedIsForeign || isLiveMode();

  const lookupKey = lookupKeyForPlan(plan.id, plan.price, interval);
  const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];

  let price: Stripe.Price;
  let created = false;
  if (existing && priceMatches(existing, plan.price, interval)) {
    price = existing.active ? existing : await stripe.prices.update(existing.id, { active: true });
  } else {
    const productId = await ensureProduct(plan);
    price = await stripe.prices.create(
      {
        product: productId,
        currency: CURRENCY,
        unit_amount: plan.price,
        recurring: { interval: interval.unit, interval_count: interval.count },
        lookup_key: lookupKey,
        metadata: { membershipPlanId: plan.id, membershipPlanSlug: plan.slug },
      },
      { idempotencyKey: `create_${lookupKey}` },
    );
    created = true;
  }

  if (mayStore && price.id !== plan.stripePriceId) {
    await prisma.membershipPlan.update({ where: { id: plan.id }, data: { stripePriceId: price.id } });
  }

  // Archive the outdated Price last, once the plan points at its replacement.
  let archivedPriceId: string | null = null;
  if (stored && stored.id !== price.id && stored.active) {
    await stripe.prices.update(stored.id, { active: false });
    archivedPriceId = stored.id;
  }

  return { stripePriceId: price.id, created, archivedPriceId };
}
