# Workstream G: Stripe webhook and data import scripts

## Built

- **Subscription invoice payments:** `src/app/api/webhooks/stripe/route.ts`
  - The new `recordInvoicePayment()` is called from the existing `invoice.payment_succeeded` handler. Per Sam, `invoice.paid` is not handled.
  - It creates one `Payment` per paid invoice:
    - type MEMBERSHIP, status SUCCEEDED
    - `amountInCents = invoice.amount_paid`
    - `stripeInvoiceId = invoice.id`, unique, so a duplicate delivery is swallowed (P2002)
    - `membershipId` set when the Membership already exists
    - `metadata`: `{ stripeSubscriptionId, billingReason, lines: [{ description, amountCents, isJoiningFee }], linesTruncated }`
  - $0 invoices are skipped. The existing renewal, period-update and ticket-allowance logic is unchanged.
- **Preorder checkouts:** `checkout.session.completed` with no `userId`/`studioSessionId` now logs and returns 200 instead of 400.
  - The Lehi preorder widget (`metadata.source === "lehi-preorder-widget"`) is logged as "not persisted".
  - Anything else is logged as a warning.
- **Gift card import:** `scripts/import-gift-cards.ts`, run as `npm run import:gift-cards -- <file.csv> [--dry-run] [--location <id>]`.
- **Waiver import:** `scripts/import-waiver-signatures.ts`, run as `npm run import:waivers -- <file.csv> [--dry-run]`.
- **Shared helper:** `scripts/lib/csv.ts` holds the CSV parser, loose header detection, dollar-to-cents and Mountain-time date parsing, and flag parsing. No CSV dependency exists and none was added.
- **Sample CSVs:** `scripts/fixtures/gift-cards-sample.csv` and `scripts/fixtures/waiver-signatures-sample.csv`. Fake data only, with variant headers, one unmatched email, a duplicate, and invalid rows.
- **`package.json` scripts:** `import:gift-cards`, `import:waivers`, `members:invite`.
  - `members:invite` uses the `terminal:e2e` pattern (tsconfig.scripts.json + tsconfig-paths), because F's script imports `@/` paths.

## Verified (local DB `throw_launch_dev` only)

- **Gift card dry run.**
  - Mapped the variant headers ("Gift Card Code", "Remaining Balance", "Purchaser Email", "Created At", "Expiry").
  - Skipped the duplicate code and the invalid balance.
  - Parsed a quoted "$1,050.50", matched 2 of 3 purchasers, and converted dates from Mountain time with correct DST offsets.
- **Waiver dry run, then a real import.**
  - Published Lehi v1 with Provo's text.
  - Inserted 3 `momence` signatures at Lehi with CSV dates and typed names. Existing Provo platform signatures were left as they were (skipDuplicates).
  - Reported `ghost@example.com` as not found, skipped the bad date, and kept the latest date for a duplicate email.
  - A second run inserted 0.
  - The Lehi waiver version and the 3 signatures are left in the local DB.
- **Webhook**, via the real `POST` handler with a locally signed event (scratchpad script, not in the repo).
  - An invoice whose Membership doesn't exist yet was recorded from the subscription metadata, with the joining-fee line flagged.
  - The duplicate delivery produced no second row.
  - The $0 invoice produced no row.
  - The preorder checkout returned 200.
  - Test rows were deleted afterwards.
- **`npm run members:invite -- --dry-run --limit 3`** starts and reports against the local DB (0 candidates there).
- **`npx tsc --noEmit`:** no errors in G's files.

## Could not verify

- **Real Stripe payloads.** Nothing was checked against real Stripe events or the live account.
  - Whether a Checkout-created one-off "Joining Fee" line appears on the first invoice with that exact description is unverified. `isJoiningFee` matches `/joining fee/i` on the line description.
- **Line-item truncation.** A webhook invoice payload may truncate `lines`, which is recorded as `linesTruncated`. This can't happen with a 2-line membership invoice.
- **Fallback location in production.** It's the oldest active location by `createdAt`. That should be Provo, but I didn't query Neon to check. Locally it picked the test Lehi row, because that row was inserted with SQL `now()`, which is a local-time artifact.

## Judgment calls

- **PaymentIntent id.** `Payment.stripePaymentIntentId` is required and unique, but in apiVersion 2026-04-22.dahlia the invoice's PaymentIntent is only reachable through `invoice.payments` or the InvoicePayments API, not in the webhook payload. So invoice payments use a deterministic placeholder `inv_<invoiceId>`, matching POS's `pos_<orderId>`.
- **Payment location.** `Payment.locationId` is required. It resolves to Membership.locationId, then plan.locationId, then the oldest active location. Rows are never dropped for lack of a location. Checkout-created memberships currently get no `locationId`; setting it at creation is out of scope, so it was left unchanged.
- **First invoice before its Membership exists.** When the first invoice beats `customer.subscription.created`, `userId`/`planId` come from `invoice.parent.subscription_details.metadata` (written by `/api/memberships/subscribe`), and `membershipId` stays null on that Payment row. Nothing backfills it later.
- **Checkouts without metadata.** Every such checkout gets 200, not just the preorder widget, because a 4xx makes Stripe retry for days. Tip checkouts with missing tip metadata still return 400 (unchanged).
- **Preorders are not persisted.** Lehi preorder checkouts exist only in Stripe; nothing is written to the database.
- **Gift card import.**
  - `initialCents` is set to the imported balance, since the original amount isn't in the CSV.
  - `createdAt` comes from `issued_at` (now if blank); `locationId` is null unless `--location` is given.
  - Existing codes are skipped, never overwritten.
  - Zero-balance cards are imported (and counted).
- **Waiver import.**
  - For duplicate emails, the most recent `signed_at` wins.
  - `ipAddress` is `"imported"`.
  - A missing studio waiver is published as a copy of the most recently published active version at any studio.
  - Signatures go to every active location.
- **CSV dates.** Date-only and zone-less date-times are read as Mountain time; ISO strings with Z or an offset are taken as-is.
- **Shared helper file.** `scripts/lib/csv.ts` is a new file outside the listed ownership. It isn't shared with any other workstream.

## Cross-workstream edits needed

None from G. G didn't apply anyone else's notes (that's Phase 3 work).

Two things for the integrator:
- `src/inngest/functions.ts` and `src/app/api/inngest/route.ts` are untouched and waiting for D's and E's requests.
- Running scripts that live **outside** the repo through ts-node needs `TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}'` plus `NODE_PATH=<repo>/node_modules`. In-repo scripts, including `members:invite`, run fine as configured.
