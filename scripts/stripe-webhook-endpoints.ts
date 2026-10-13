// Registers the app's webhook endpoint in every configured Stripe account
// (src/lib/stripeAccounts.ts): the default STRIPE_SECRET_KEY account and each
// STRIPE_SECRET_KEY_<STUDIO>. Provo and Lehi are separate accounts, and each
// one has to deliver its own events to /api/webhooks/stripe with its own
// signing secret.
//
// Dry run by default: lists the endpoints each account already has. With
// --apply it creates the endpoint where none points at our URL yet and prints
// the signing secret ONCE (Stripe never shows it again; the dashboard can
// reveal it later). Put each secret in STRIPE_WEBHOOK_SECRET (default account)
// or STRIPE_WEBHOOK_SECRET_<STUDIO> on Vercel, then redeploy.
//
//   STRIPE_SECRET_KEY=sk_live_… STRIPE_SECRET_KEY_LEHI=sk_live_… \
//     npx tsx --tsconfig tsconfig.json scripts/stripe-webhook-endpoints.ts [--apply] [--url https://…/api/webhooks/stripe]
//
// Needs no database. Sandbox and live are separate too: run it with the keys
// of the mode you are setting up.

import type Stripe from "stripe";
import { configuredStripeAccounts } from "@/lib/stripeAccounts";

const APPLY = process.argv.includes("--apply");
const urlArg = process.argv.indexOf("--url");
const WEBHOOK_URL =
  urlArg > -1
    ? process.argv[urlArg + 1]
    : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.throwartstudios.app"}/api/webhooks/stripe`;

// Every event src/app/api/webhooks/stripe/route.ts handles.
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "payment_intent.succeeded",
] as const;

async function main() {
  const accounts = configuredStripeAccounts();
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set; nothing to do");
    process.exitCode = 1;
    return;
  }
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(APPLY ? "APPLY: creating missing endpoints" : "dry run: re-run with --apply to create");

  for (const account of accounts) {
    const name = account.suffix ? `${account.label} (STRIPE_SECRET_KEY_${account.suffix})` : "default (STRIPE_SECRET_KEY)";
    const envName = account.suffix ? `STRIPE_WEBHOOK_SECRET_${account.suffix}` : "STRIPE_WEBHOOK_SECRET";
    console.log(`\n== ${name}: ${account.live ? "LIVE" : "test"} mode`);

    const { client } = account;
    const existing = (await client.webhookEndpoints.list({ limit: 100 })).data;
    for (const w of existing) {
      console.log(`   has ${w.id} → ${w.url} [${w.status}] ${w.enabled_events.length} events`);
    }
    const ours = existing.find((w) => w.url === WEBHOOK_URL && w.status === "enabled");
    if (ours) {
      const missing = EVENTS.filter((e) => !ours.enabled_events.includes(e) && !ours.enabled_events.includes("*"));
      if (missing.length === 0) {
        console.log(`   already registered (${ours.id}); its signing secret belongs in ${envName}`);
        continue;
      }
      console.log(`   ${ours.id} is missing events: ${missing.join(", ")}`);
      if (APPLY) {
        await client.webhookEndpoints.update(ours.id, {
          enabled_events: [
            ...new Set([...ours.enabled_events, ...EVENTS]),
          ] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
        });
        console.log(`   updated ${ours.id}; its signing secret (unchanged) belongs in ${envName}`);
      }
      continue;
    }

    if (!APPLY) {
      console.log(`   would create an endpoint for ${WEBHOOK_URL} (${EVENTS.length} events)`);
      continue;
    }
    const created = await client.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: [...EVENTS],
      description: "Throw app (src/app/api/webhooks/stripe)",
    });
    console.log(`   created ${created.id}`);
    console.log(`   ${envName}=${created.secret}`);
    console.log("   (shown once; copy it into Vercel now)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
