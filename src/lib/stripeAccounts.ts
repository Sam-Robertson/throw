import Stripe from "stripe";

/**
 * One Stripe account per studio.
 *
 * Provo and Lehi are separate Stripe accounts, so every Stripe call has to be
 * made with the key of the studio the money belongs to. The keys come from the
 * environment, one set per studio, named after the studio:
 *
 *   STRIPE_SECRET_KEY_LEHI        sk_live_...   (required for the studio to have its own account)
 *   STRIPE_PUBLISHABLE_KEY_LEHI   pk_live_...   (POS typed-in card entry)
 *   STRIPE_WEBHOOK_SECRET_LEHI    whsec_...     (that account's endpoint for /api/webhooks/stripe)
 *
 * The suffix is the studio's name in Location.name, upper-cased, with runs of
 * anything but letters and digits turned into "_" (see studioEnvSuffix).
 *
 * A studio with no key of its own, and anything with no studio at all, uses the
 * default account: STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY /
 * STRIPE_WEBHOOK_SECRET. In production that is Provo's account.
 *
 * This module reads the environment only; the location lookups that turn a
 * locationId into a studio name live in src/lib/stripe.ts so this part stays
 * unit-testable.
 */

export const STRIPE_API_VERSION = "2026-04-22.dahlia";

export interface StripeAccount {
  /** Env suffix the keys were read from ("LEHI"), or "" for the default account. */
  suffix: string;
  /** For admin screens and logs: "Lehi", or "default". */
  label: string;
  /** True when this is the STRIPE_SECRET_KEY account (also when a suffix repeats that key). */
  isDefault: boolean;
  client: Stripe;
  live: boolean;
  publishableKey: string | null;
  webhookSecret: string | null;
}

/** "Lehi" → "LEHI", "Salt Lake City" → "SALT_LAKE_CITY". */
export function studioEnvSuffix(studioName: string): string {
  return studioName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function isLiveKey(secretKey: string): boolean {
  return /^(sk|rk)_live_/.test(secretKey);
}

function labelFor(suffix: string): string {
  if (!suffix) return "default";
  return suffix
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// One client per secret key (so two suffixes sharing a key compare equal), and
// a suffix → account map on top so lookups are cheap.
const accountsBySecret = new Map<string, StripeAccount>();
const accountsBySuffix = new Map<string, StripeAccount>();

/** Forgets the cached clients; tests change the environment between cases. */
export function resetStripeAccountCache(): void {
  accountsBySecret.clear();
  accountsBySuffix.clear();
}

function buildAccount(suffix: string, secretKey: string): StripeAccount {
  const existing = accountsBySecret.get(secretKey);
  if (existing) return existing;
  const sfx = suffix ? `_${suffix}` : "";
  const account: StripeAccount = {
    suffix,
    label: labelFor(suffix),
    isDefault: secretKey === (env("STRIPE_SECRET_KEY") ?? ""),
    client: new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION }),
    live: isLiveKey(secretKey),
    publishableKey:
      env(`STRIPE_PUBLISHABLE_KEY${sfx}`) ?? env(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY${sfx}`) ?? null,
    webhookSecret: env(`STRIPE_WEBHOOK_SECRET${sfx}`) ?? null,
  };
  accountsBySecret.set(secretKey, account);
  return account;
}

/**
 * The STRIPE_SECRET_KEY account. Falls back to a placeholder key so the app
 * can be built (and pages rendered) without Stripe configured; any real call
 * with it fails.
 */
export function defaultStripeAccount(): StripeAccount {
  const cached = accountsBySuffix.get("");
  if (cached) return cached;
  const account = buildAccount("", env("STRIPE_SECRET_KEY") ?? "placeholder_build");
  accountsBySuffix.set("", account);
  return account;
}

/** True when the studio has its own STRIPE_SECRET_KEY_<STUDIO>. */
export function studioHasOwnStripeAccount(studioName: string): boolean {
  const suffix = studioEnvSuffix(studioName);
  return suffix !== "" && env(`STRIPE_SECRET_KEY_${suffix}`) !== undefined;
}

/** The account for a studio by name; the default account when it has no key of its own. */
export function stripeAccountForStudio(studioName: string | null | undefined): StripeAccount {
  if (!studioName) return defaultStripeAccount();
  const suffix = studioEnvSuffix(studioName);
  if (!suffix) return defaultStripeAccount();
  const cached = accountsBySuffix.get(suffix);
  if (cached) return cached;
  const secretKey = env(`STRIPE_SECRET_KEY_${suffix}`);
  const account = secretKey ? buildAccount(suffix, secretKey) : defaultStripeAccount();
  accountsBySuffix.set(suffix, account);
  return account;
}

/**
 * Every distinct account the environment knows about: the default one plus
 * each STRIPE_SECRET_KEY_<STUDIO>. For the places that get a Stripe id with
 * no studio attached (a webhook delivery, a Checkout Session id in a URL) and
 * have to find out which account it belongs to.
 */
export function configuredStripeAccounts(): StripeAccount[] {
  const accounts = [defaultStripeAccount()];
  const suffixes = Object.keys(process.env)
    .filter((k) => k.startsWith("STRIPE_SECRET_KEY_"))
    .map((k) => k.slice("STRIPE_SECRET_KEY_".length))
    .sort();
  for (const suffix of suffixes) {
    const secretKey = env(`STRIPE_SECRET_KEY_${suffix}`);
    if (!secretKey) continue;
    const account = accountsBySuffix.get(suffix) ?? buildAccount(suffix, secretKey);
    accountsBySuffix.set(suffix, account);
    if (!accounts.includes(account)) accounts.push(account);
  }
  return accounts;
}

/** Stripe's "that id doesn't exist here": also what another account's id looks like. */
export function isStripeMissing(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
}
