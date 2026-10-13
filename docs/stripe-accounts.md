# Stripe: one account per studio

Provo and Lehi are separate Stripe accounts. Since 2026-10-13 the app charges
each studio's sales, memberships, tips, reader payments and tax into that
studio's own account. The code that decides which account is
`src/lib/stripeAccounts.ts` (keys from the environment) and `src/lib/stripe.ts`
(location → account).

## How a studio gets its own account

Keys are environment variables named after the studio: `Location.name`
upper-cased, with runs of anything but letters and digits turned into `_`
("Lehi" → `LEHI`, "Salt Lake City" → `SALT_LAKE_CITY`).

| Variable | What |
|---|---|
| `STRIPE_SECRET_KEY` | The default account (Provo's in production). Used by any studio without keys of its own, by anything with no studio, and by scripts. |
| `STRIPE_WEBHOOK_SECRET` | The default account's endpoint for `/api/webhooks/stripe`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | The default account's publishable key (POS typed-in card entry). |
| `STRIPE_SECRET_KEY_LEHI` | Lehi's secret key. Its presence is what gives Lehi its own account. |
| `STRIPE_WEBHOOK_SECRET_LEHI` | Lehi's endpoint for the same `/api/webhooks/stripe` URL. |
| `STRIPE_PUBLISHABLE_KEY_LEHI` | Lehi's publishable key. |
| `PREORDER_STUDIO` | Which studio's account the Squarespace preorder widget sells through. Default `Lehi`. |

Studio setup → Card readers says which account each studio is on, so a studio
silently sharing the default account is visible.

## What lives where

- **Memberships.** A plan's Stripe Product and Prices are created lazily in
  the plan's studio's account (`src/lib/stripePrices.ts`); a plan with no
  studio uses the default account. The subscription, its schedule when paused,
  and the freeze price are all in that account. A member can't switch to a
  plan at the other studio (`/api/memberships/change-plan` returns
  `OTHER_STUDIO`); that is a cancel and a new membership.
- **Customers.** A Stripe Customer exists in one account only.
  `User.stripeCustomerId` is the default account's Customer; a Customer made
  in another account is only remembered on the Membership (the webhook writes
  `Membership.stripeCustomerId`). Every id is checked against the account
  before use (`src/lib/stripeCustomers.ts`), so a sandbox id or the other
  account's id is just not used, and the default account's stale id is
  replaced the next time a Customer is needed there.
- **Classes and tips** paid online go through the session's studio.
- **POS.** PaymentIntents, the Terminal location, readers, the on-reader tip
  setting and Stripe Tax are all per studio. The typed-in card form is told
  which publishable key to load with each PaymentIntent.
- **Webhooks.** Each account has its own endpoint at the same URL. The route
  tries every configured signing secret; the one that verifies says which
  account sent the event. Nothing in the webhook calls Stripe back, and
  subscription, invoice and PaymentIntent ids are unique across accounts.
- **The preorder widget** (`/api/preorder/checkout`) sells through Lehi's
  account, so the price ids in its Squarespace CONFIG must be Prices in
  Lehi's live account.

## Cutover runbook (live keys, 2026-10)

Order matters: a live secret key with no matching webhook secret takes real
money and never records the booking or membership. Keys go in before the
deploy, all of them together.

1. **Webhook endpoints.** One per live account, both pointing at
   `https://www.throwartstudios.app/api/webhooks/stripe`. The script does it
   and prints each signing secret once:

   ```bash
   STRIPE_SECRET_KEY=sk_live_PROVO… STRIPE_SECRET_KEY_LEHI=sk_live_LEHI… \
     npx tsx --tsconfig tsconfig.json scripts/stripe-webhook-endpoints.ts            # dry run
   STRIPE_SECRET_KEY=sk_live_PROVO… STRIPE_SECRET_KEY_LEHI=sk_live_LEHI… \
     npx tsx --tsconfig tsconfig.json scripts/stripe-webhook-endpoints.ts --apply
   ```

   (Or Dashboard → Developers → Webhooks in each account, live mode, and
   reveal the signing secret.)

2. **Vercel production env.** `vercel env add NAME production --force`
   overwrites an existing value; it reads the value from stdin:

   ```bash
   printf '%s' 'sk_live_PROVO…'  | vercel env add STRIPE_SECRET_KEY production --force
   printf '%s' 'pk_live_PROVO…'  | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production --force
   printf '%s' 'whsec_PROVO…'    | vercel env add STRIPE_WEBHOOK_SECRET production --force
   printf '%s' 'sk_live_LEHI…'   | vercel env add STRIPE_SECRET_KEY_LEHI production
   printf '%s' 'pk_live_LEHI…'   | vercel env add STRIPE_PUBLISHABLE_KEY_LEHI production
   printf '%s' 'whsec_LEHI…'     | vercel env add STRIPE_WEBHOOK_SECRET_LEHI production
   ```

   Leave Preview on the sandbox key.

3. **Deploy** this code (merge to `main`).

4. **After the deploy**, in each live account:
   - Provo: run `scripts/reset-sandbox-stripe-ids-2026-09-24.ts` with the
     live key (dry run, then `--apply`) to clear the sandbox Terminal location
     and customer ids. Then Studio setup → Card readers: set up Provo again,
     pair the reader, switch the tip screen on.
   - Lehi: Studio setup → Card readers: set up Lehi (creates its Terminal
     location in Lehi's account), pair its reader, switch the tip screen on.
   - Stripe Tax: switch on in both accounts with a Utah registration, or POS
     sales show the "charging without tax" banner.
   - Preorder widget: recreate its Prices in Lehi's live account and update
     the widget's CONFIG.

Membership plan prices need nothing: they self-heal into the right account at
the first checkout.
