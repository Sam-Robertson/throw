import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  configuredStripeAccounts,
  defaultStripeAccount,
  resetStripeAccountCache,
  stripeAccountForStudio,
  studioEnvSuffix,
  studioHasOwnStripeAccount,
} from "./stripeAccounts";

const KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_SECRET_KEY_LEHI",
  "STRIPE_SECRET_KEY_PROVO",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET_LEHI",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PUBLISHABLE_KEY_LEHI",
];

describe("studioEnvSuffix", () => {
  it("upper-cases a studio name and joins words with _", () => {
    expect(studioEnvSuffix("Lehi")).toBe("LEHI");
    expect(studioEnvSuffix("Provo")).toBe("PROVO");
    expect(studioEnvSuffix(" Salt Lake City ")).toBe("SALT_LAKE_CITY");
    expect(studioEnvSuffix("St. George")).toBe("ST_GEORGE");
  });
});

describe("stripe accounts from the environment", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetStripeAccountCache();
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetStripeAccountCache();
  });

  it("uses the default account for a studio with no key of its own", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_default";
    const account = stripeAccountForStudio("Lehi");
    expect(account).toBe(defaultStripeAccount());
    expect(account.isDefault).toBe(true);
    expect(account.live).toBe(false);
    expect(studioHasOwnStripeAccount("Lehi")).toBe(false);
  });

  it("gives a studio its own account when STRIPE_SECRET_KEY_<STUDIO> is set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_provo";
    process.env.STRIPE_SECRET_KEY_LEHI = "sk_live_lehi";
    process.env.STRIPE_PUBLISHABLE_KEY_LEHI = "pk_live_lehi";
    process.env.STRIPE_WEBHOOK_SECRET_LEHI = "whsec_lehi";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_provo";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_provo";

    const lehi = stripeAccountForStudio("Lehi");
    const provo = stripeAccountForStudio("Provo");

    expect(lehi).not.toBe(provo);
    expect(lehi.suffix).toBe("LEHI");
    expect(lehi.label).toBe("Lehi");
    expect(lehi.isDefault).toBe(false);
    expect(lehi.live).toBe(true);
    expect(lehi.publishableKey).toBe("pk_live_lehi");
    expect(lehi.webhookSecret).toBe("whsec_lehi");
    expect(studioHasOwnStripeAccount("Lehi")).toBe(true);

    expect(provo).toBe(defaultStripeAccount());
    expect(provo.publishableKey).toBe("pk_live_provo");
    expect(provo.webhookSecret).toBe("whsec_provo");
  });

  it("treats a suffix that repeats the default key as the same account", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_provo";
    process.env.STRIPE_SECRET_KEY_PROVO = "sk_live_provo";
    process.env.STRIPE_SECRET_KEY_LEHI = "sk_live_lehi";
    const provo = stripeAccountForStudio("Provo");
    expect(provo).toBe(defaultStripeAccount());
    expect(provo.isDefault).toBe(true);
    expect(configuredStripeAccounts()).toHaveLength(2);
  });

  it("lists each distinct account once", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_provo";
    process.env.STRIPE_SECRET_KEY_LEHI = "sk_live_lehi";
    const accounts = configuredStripeAccounts();
    expect(accounts.map((a) => a.suffix)).toEqual(["", "LEHI"]);
    expect(accounts[0]).toBe(defaultStripeAccount());
    expect(accounts[1]).toBe(stripeAccountForStudio("Lehi"));
  });

  it("falls back to a placeholder key so a build without Stripe still works", () => {
    const account = defaultStripeAccount();
    expect(account.live).toBe(false);
    expect(account.publishableKey).toBeNull();
    expect(account.webhookSecret).toBeNull();
  });
});
