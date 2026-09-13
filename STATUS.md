# Feature Status — Throw

Audited 2026-09-12 on branch `rich-text-editor` (HEAD `6086735`), including the uncommitted report changes in the working tree.

**How to read this**
- **DONE**: works end to end in code, and nothing in config or data blocks it.
- **PARTIAL**: exists but is incomplete. What's missing is listed.
- **STUB**: the route or page exists but has no real logic.
- **NOT STARTED**: nothing in the schema or code.

**No item scored STUB.** The thin pages that look like stubs all delegate to real components:
- `/admin/tips/page.tsx` (11 lines) renders `AdminTipsClient.tsx`.
- `/admin/studio-setup/roles/page.tsx` (10 lines) renders the 520-line `RolesClient.tsx`.
- `(staff)/staff/page.tsx` is 229 lines of real queries.

**Evidence rules**
- Every verdict comes from reading the code in this pass. `AUDIT.md` (2026-07-22) predates commit `cc8b7d4` (POS, tips, roles, shelves, Sendblue), so parts of it are out of date. It was not used as a source.
- "Data state" lines come from **read-only** queries against the database `.env` points at (Neon host `ep-withered-mode-ap4c7mbj…`). I did not determine whether that database is production. Vercel's env vars were not visible, so config claims only cover the local `.env` / `.env.local`.
- Nothing was run end to end against live Stripe, Sendblue, Resend or Inngest. Where a verdict depends on that, it says so.

---

## Summary

| # | Item | Status |
|---|---|---|
| 1 | Multi-location scoping (staff restriction / admin toggle) | **PARTIAL** (toggle) / **NOT STARTED** (staff restriction) |
| 2 | Public class/course booking with Stripe checkout | **PARTIAL** |
| 3 | Course recurrence; resource/wheel capacity | **NOT STARTED** / **NOT STARTED** (only per-session headcount capacity) |
| 4 | Waiver signing at booking; editor; signature search | **PARTIAL** (signing, editor) / **NOT STARTED** (search) |
| 5 | Pottery piece intake, status, ready notifications | **NOT STARTED** |
| 6 | POS: catalog, cart, Terminal, receipts, drawer, tips by instructor | **PARTIAL** |
| 7 | Membership plans + lifecycle, billing anchor, joining fee | **PARTIAL** |
| 8 | Class ticket credit ledger + backfill script | **PARTIAL** (code complete, never exercised on real data) |
| 9 | Clay cost calculator / weight-based charges | **NOT STARTED** |
| 10 | Momence importer | **PARTIAL** (see entity list) |
| 11 | Gift cards: issue, redeem, balance, migration | **PARTIAL** |
| 12 | SMS (Twilio→Sendblue, Inngest) and email (Resend) | **PARTIAL**: nothing is verified to send today |
| 13 | Inbox: tag filters, mark unread, tag a colleague | **NOT STARTED** (all three) |
| 14 | Reporting: metrics, location + date filters | **PARTIAL** (date range yes, location no) |
| 15 | Cancellation and freeze intake forms | **NOT STARTED** |
| 16 | Customer portal | **PARTIAL** |

---

## 1. Multi-location scoping — PARTIAL (admin toggle) / NOT STARTED (staff restriction)

### Can admin toggle All / Lehi / Provo? Partially.
**What exists**
- A sidebar switcher in `src/app/admin/_components/AdminNav.tsx`, backed by `src/app/admin/_components/LocationFilterContext.tsx`.
- It offers All Locations plus every active `Location`, with short names from `src/lib/locationName.ts`. It defaults to Provo.
- The selection is stored **client-side in `localStorage`** (`throw_admin_location_filter`). The server never sees it.

**Pages that honour it** (via `useLocationFilter()`): only two.
- `/admin/schedule` (`src/app/admin/schedule/page.tsx`) passes `locationId` to `/api/admin/studio-sessions`.
- `/admin/class-types` (`src/app/admin/class-types/page.tsx`) passes `locationId` to `/api/admin/session-types`.

**Pages that ignore it**
- **Dashboard:** `src/app/admin/page.tsx`. Its API, `src/app/api/admin/dashboard/route.ts`, has no `locationId` handling at all.
- **Inbox:** `/api/admin/inbox*`, no location handling.
- **Reports:** all 5 `/api/admin/reports/*` routes, no location handling.
- **Customers, memberships, tasks, tips.**
- **POS:** has its own separate location picker in `src/app/admin/pos/_components/PosTerminal.tsx` (local `useState`). It doesn't read the sidebar switcher.

### Can staff be restricted to one location? No.
**What the schema supports**
- `StaffRoleAssignment` has `locationId` (`@@unique([userId, locationId])`).
- `checkPermission(userId, key, locationId?)` in `src/lib/permissions.ts` accepts a location.
- Roles and assignments can be edited at `/admin/studio-setup/roles` (`RolesClient.tsx`, `/api/admin/staff-roles`, `/api/admin/staff-assignments`).

**Why it doesn't restrict anything**
- **No call site passes `locationId` to `checkPermission`.** A repo-wide grep finds 34 calls, all with two arguments, so a permission granted at any studio applies everywhere.
- **Every admin API only checks `role === "ADMIN" | "STAFF"`,** so any STAFF user can read every location's inbox, customers, dashboard and schedule. `src/middleware.ts` gates `/admin/*` the same way.
- **The staff home ignores location.** `(staff)/staff/page.tsx` lists *all* of today's sessions with no location filter, even though it displays the staff member's assigned location.

**Data state:** 3 `StaffRoleAssignment` rows, all at Provo. Sessions: 4,959 at Provo, 116 at Lehi.

---

## 2. Public class/course booking with Stripe checkout — PARTIAL

**Flow**
1. `/schedule` → `/schedule/[id]` (`src/app/(public)/schedule/[id]/page.tsx`) links to `/book/[id]`.
2. `/book/[id]` renders `BookingForm.tsx`, which calls one of two routes:
   - **Members:** `POST /api/bookings` (`src/app/api/bookings/route.ts`). Consumes a ticket for finite plans and auto-waitlists at capacity.
   - **Non-members:** `POST /api/bookings/checkout`, which creates a Stripe Checkout session for `SessionType.dropInPriceCents`.
3. On payment, `checkout.session.completed` in `src/app/api/webhooks/stripe/route.ts` creates the `Booking` (source `DROP_IN`) and a `Payment` row, then fires `booking/confirmed`.
4. `/booking/success` confirms.

**Class marketing pages:** `src/content/classes.ts` defines `bookHref` values pointing at `/schedule?type=…`. I didn't trace where `/classes/[slug]` renders them.

**Gaps**
- **No login-free booking.** `/book/*` requires an account (`src/middleware.ts`), and so does `/api/bookings/checkout`.
- **Capacity isn't checked before payment.** It's only checked in the webhook, so a customer can pay and then land on `WAITLIST` with no refund path.
- **The waiver check is UI-only.** It lives in `/book/[id]/page.tsx`; neither API route checks it (see #4).
- **No "course" concept.** A 4-week course is booked the same way as a single session (see #3).
- **Lehi preorder widget.** A separate public path, `POST /api/preorder/checkout`, is called cross-origin from Squarespace.
  - It creates a Checkout session but **writes no DB rows**.
  - Its metadata has no `userId`/`studioSessionId`, so if the Stripe account's webhook points at `/api/webhooks/stripe`, those completions fall into the drop-in branch and get a `400 "Missing metadata"`.
  - The file has a `TODO` about placeholder success/cancel slugs.
- **Not verified live.** `.env` has a test Stripe key and no `STRIPE_WEBHOOK_SECRET`, so the webhook half can't run locally as configured.

---

## 3. Course recurrence and resource/wheel capacity — NOT STARTED

**Recurrence**
- `StudioSession` is a single dated row. There's no series or parent model and no recurrence rule.
- `POST /api/admin/studio-sessions` creates one session at a time and rejects duplicate slots.
- The admin schedule UI has no repeat or bulk-create option (checked `src/app/admin/schedule/page.tsx`).
- The only "course" references are marketing copy (`src/content/classes.ts`, `src/content/site.ts`), the Lehi preorder widget, and `MembershipPlan.includesOnlineCourse`, a boolean that's only displayed.

**Resource/wheel capacity**
- There's no `Resource`/`Wheel` model. Capacity is a single headcount integer on `SessionType.capacity` / `StudioSession.capacity`, enforced by counting `CONFIRMED` bookings (anything over capacity goes to `WAITLIST`).
- The Momence import mapped Momence's "Pottery Wheel 1–10" resource locations onto the Provo `Location` and discarded the per-wheel distinction (see caveats in `momence-export/mapped/report.json`).

---

## 4. Waivers — PARTIAL (signing, editor) / NOT STARTED (signature search)

**Signing: works, but is only enforced in the UI**
- `/waiver` + `src/components/shared/WaiverSignatureForm.tsx` post to `POST /api/waivers/sign`, which stores `WaiverSignature` (typed name, signature image, IP, timestamp).
- `/book/[id]/page.tsx` redirects to `/waiver?callbackUrl=…` if the active `WaiverVersion` is unsigned.
- **Neither `POST /api/bookings` nor `POST /api/bookings/checkout` checks the waiver,** so a direct API call, the POS, or admin-created bookings skip it.
- The dashboard shows waiver status.

**Editor: works**
- `/admin/waivers` uses `RichTextEditor` (latest commit) and `POST /api/admin/waivers`.
- Publishing a new version deactivates the prior one in a transaction.

**Location handling is inconsistent**
- `WaiverVersion` is per-location, but `/book/[id]` looks up "the active waiver" without regard to the session's location.
- Data state: 1 active version (Provo), 10 signatures.

**Signature search: not started**
- `GET /api/admin/waivers/[id]/signatures` only paginates by version. There's no search parameter.
- Signatures are visible per customer on `/admin/customers/[id]`, but you can't search across signatures.

---

## 5. Pottery piece intake / status / ready notifications — NOT STARTED

- There's no model for pieces, firing, or pickup in `prisma/schema.prisma`, and no route or page for them.
- Today this process lives in a Google Sheet (`sheets-export/pottery-pieces-form.xlsx`). `scripts/sheets-map.py` explicitly drops the kiln/firing tabs ("no schema home") and only imports customer name/phone and shelf data.
- The marketing copy promises "we'll text you when your pieces are ready" (`src/content/classes.ts`), but no code backs it.
- Related, and does exist: shelf space assignment and a waitlist (`ShelfSpace`, `ShelfWaitlistEntry`, `/admin/studio-setup/shelves`). Data state: 47 shelf spaces.

---

## 6. POS — PARTIAL

### Catalog: works
- `GET /api/pos/catalog` returns retail products, drop-in session types and membership plans.
- `CatalogPanel.tsx` has Retail / Drop-in / Membership / Gift Card / Custom tabs.

### Cart and orders: work, with gaps in what line items actually do
- Endpoints: `/api/pos/orders`, `/api/pos/orders/[id]/items`, `/api/pos/orders/[id]/void`.
- Totals are recomputed server-side (`src/lib/pos.ts` `recalculateOrderTotals`).
- **Tax is hard-coded to 0** (there's a `TODO` in `calculateOrderTotals`).
- **Drop-in and membership line items only charge money.** A `DROP_IN` item doesn't create a `Booking`, and a `MEMBERSHIP` item doesn't create a `Membership`. The UI says so: "Memberships sold here create a one time charge" (`CatalogPanel.tsx`).

### Stripe Terminal, server-driven reader flow: code complete
- **Endpoints**
  - `POST /api/pos/orders/[id]/payments/card-terminal` calls `stripe.terminal.readers.processPaymentIntent` with on-reader tipping.
  - `…/terminal-status` (polled) and `…/terminal-cancel`.
- **Libraries and UI:** `src/lib/terminal.ts`, `TerminalPane.tsx`.
- **Webhook settlement:** `payment_intent.succeeded` → `settleTerminalPayment`.
- **Setup:** reader and location management at `/admin/studio-setup/card-readers`.
- **Verified in test mode only:** `scripts/terminal-e2e.ts` runs against a simulated WisePOS E (refuses non-test keys).
- **Lehi can't take card-reader payments yet.** Its `Location.stripeTerminalLocationId` is null; Provo is linked (`tml_…`).

### Other payment methods
- **Cash:** `…/payments/cash`
- **Manual card:** `…/payments/card-manual`, which needs `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. That key isn't in `.env`.
- **Gift card:** `…/payments/gift-card`
- **Comp:** `…/payments/comp`

### Receipts: code exists, delivery unverified
- Order completion (`maybeCompletePosOrder`) fires the Inngest event `pos/order.completed`, which runs `sendPosReceipt` in `src/inngest/functions.ts`. It emails via Resend, or falls back to SMS.
- `POST /api/pos/orders/[id]/receipt` re-sends.
- Delivery depends on Inngest and Resend keys, which are missing (see #12). Receipt content is plain text.

### Cash drawer: works
- Endpoints: `/api/pos/drawer/open|current|close|history`, and the `/admin/pos/drawer` page.
- Expected cash and variance are computed in `computeDrawerExpectedCash`.

### Tips by instructor: only booking tips have an instructor
- **Booking tips**
  - Customers tip after class at `/bookings/[id]/tip`.
  - `POST /api/tips` creates a Stripe Checkout session; the webhook creates the `Tip` row (which has `instructorId`).
  - Reporting and payouts at `/admin/tips` (`/api/admin/tips`, `…/payout`, `…/payout-bulk`) and `/staff/tips`.
- **POS reader tips have no instructor.** They're added to `PosOrder.tipCents` only. `PosOrder` has no instructor field, so they can't be split by instructor and don't appear in `/admin/tips`.

**Data state:** 12 `PosOrder`s, all `OPEN`, and 0 `PosPayment` rows. **No POS order has ever completed** in this database.

---

## 7. Membership plans and lifecycle — PARTIAL (code largely there; not operable on current data)

### Plans: there are no live Basic, Pro or Expert plans
- The schema has everything needed on `MembershipPlan`: `classTicketsPerPeriod`, rollover, `joiningFeeCents`, `commitmentMonths`, `billingAnchorDay`, `shelfType`, `stripePriceId`.
- `prisma/seed.ts` defines Basic/Pro/Expert variants with `billingAnchorDay: 1` and `joiningFeeCents: 2500`.
- **None of those seed plans exist in the database.**
  - All Basic/Pro/Expert rows are Momence imports: **inactive**, `stripePriceId: null`, no anchor, no joining fee. They were deactivated by `scripts/deactivate-unpayable-plans.ts`.
  - The 4 active plans are "Open Studio Monthly", "Studio Plus", "Annual Membership" (all with `stripePriceId: "price_placeholder_*"`, so Stripe will reject them) and "Pro - 3 Month Commitment Membership" (no price ID, so subscribe returns "Plan not configured for payments").
- **Admin can't set the new fields.** `/admin/membership-plans` and `/api/admin/membership-plans` only edit price ID, tickets and rollover. There are no inputs for `joiningFeeCents`, `billingAnchorDay`, `commitmentMonths`, `shelfType`, etc., so those can only be set through the seed or SQL.

### Lifecycle routes
Customer routes live in `src/app/api/memberships/*`.

**Subscribe:** `subscribe/route.ts` creates a Stripe Checkout session in subscription mode. On `customer.subscription.created`, the webhook creates the `Membership`, logs a `CREATED` event, grants the ticket allowance, and sets `commitmentEndsAt`.

**Billing anchor on the 1st:** implemented.
- `billing_cycle_anchor` is set to the next occurrence of the chosen day, midnight Mountain Time, with prorations.
- No plan in the database has `billingAnchorDay` set.

**Joining fee:** implemented.
- It's added as a one-off line item only if the user has never held any `Membership`.
- It's recorded as `joiningFeePaid` via subscription metadata.
- No plan in the database has a fee.

**Pause:** doesn't actually pause.
- It sets `cancel_at_period_end` on the Stripe subscription plus `resumesAt` = period end + 30 days.
- When Stripe deletes the subscription, the webhook marks it `PAUSED`.
- **Nothing automatically resumes it on `resumesAt`.** There's no scheduled job.

**Resume:** manual only, by the customer.
- It creates a brand-new Stripe subscription with no billing anchor.
- The admin UI has no resume button: `/admin/memberships` only offers pause and cancel.

**Cancel:** works.
- The customer route blocks cancellation during a commitment.
- The admin route (`/api/admin/memberships/[id]/cancel`) can override the commitment and logs that it did.

**Change plan / upgrade:** changes the plan and logs the event, with three gaps.
- It swaps the subscription item with proration and logs `UPGRADED`/`DOWNGRADED`.
- **It doesn't re-grant or adjust the ticket allowance.**
- **It doesn't check the commitment.**
- **It doesn't charge a joining fee.**

**Past due:** Stripe's `past_due` and `invoice.payment_failed` both map to `PAUSED`, with the event logged as `CANCELLED`.

### Data state: lifecycle can't run on existing members
- 449 memberships: 308 `ACTIVE`, 139 `PAUSED`, 2 `CANCELLED`.
- **Only 4 have a `stripeSubscriptionId`.**
- For the other 445 (Momence imports), pause, resume, cancel and change-plan all return `"No Stripe subscription found"`. Imported members aren't billed by this app.

---

## 8. Class ticket credit ledger and backfill — PARTIAL (code complete, never exercised on real data)

**The ledger code is complete**
- **Model:** `MembershipCreditLedger`.
- **Logic** (`src/lib/credits.ts`):
  - The balance is the sum of deltas.
  - `grantPeriodAllowance` is idempotent per period and handles expiry and capped rollover under a row lock.
  - `consumeTicket` takes a row lock.
  - `refundTicket` is idempotent.
- **Where it's wired in**
  - Booking: `POST /api/bookings` consumes a ticket.
  - Customer cancel: `…/[id]/cancel` refunds it, but only outside 2 hours.
  - Admin status change: `PATCH /api/admin/bookings/[id]` refunds it.
  - Stripe webhook (subscription created, invoice paid): grants the period allowance.
  - Manual adjustment: `POST /api/admin/memberships/[id]/adjust-tickets` (ADMIN), called from `/admin/customers/[id]`.
- **Where balances are shown:** customer dashboard, `/membership/manage`, `/book/[id]`, and the admin customer page.

**Backfill script: correct but has nothing to do**
- `prisma/backfill-tickets.ts` grants the allowance for the current period, then debits each `MEMBER_FREE` booking already made in that period. It skips unlimited plans and memberships that already have ledger rows.
- It isn't in `package.json`. The header says `npx tsx`, but `tsx` isn't a dependency (the repo uses `ts-node`).

**Data state**
- **0 ledger rows.**
- **0 active/paused memberships are on a finite-ticket plan.** Every plan in the database has `classTicketsPerPeriod: null` (unlimited), so the backfill would currently do nothing.
- Separately, 800 bookings carry `source: MEMBERSHIP_CREDIT`. They're Momence imports, not ledger bookings: their ids use the `mbk_sb_…` prefix from `scripts/momence-map.ts`, their source was set by `scripts/sales-apply.ts`, and none has a `membershipId`. They have no ledger entries.

---

## 9. Clay cost calculator / weight-based charges — NOT STARTED

- There's no clay, weight or firing-fee model, calculator, or route. The only mentions are marketing copy ("1 lb of clay", "$10 when you pick up your 1lb piece") and a "Firing fee" *placeholder* in the POS Custom-item field (`CatalogPanel.tsx`).
- There's no way to add a charge to a member's next invoice (no Stripe `invoiceItems` usage anywhere).
- The closest workaround today is a manual POS Custom line item.

---

## 10. Momence importer — PARTIAL

**This isn't a CSV importer.**
- `scripts/momence-export.ts` pulls from the Momence **API** (`/api/v2/host/...`) into `momence-export/*.json`.
- `scripts/momence-map.ts` transforms that into `momence-export/mapped/*.json` plus `report.json`.
- `scripts/momence-apply.ts` writes to the database with `createMany({skipDuplicates})`.
- There's also `momence-catalog-export.ts`, a catalog pull via the widget token.

**What is imported**

| Entity | Script | Notes |
|---|---|---|
| Customers → `User` | momence-apply | 7,705 imported. Name, email, phone only. No password, no Stripe customer. |
| Membership plans → `MembershipPlan` | momence-apply | 53 plans. `billingIntervalDays` hard-coded to 30, no `stripePriceId`. Since deactivated. |
| Memberships → `Membership` | momence-apply | 445 of 633. The 188 with no start/end dates were skipped. **No Stripe subscription linked.** |
| Class types → `SessionType` | momence-apply | Null capacity mapped to 999. |
| Sessions + appointments → `StudioSession` | momence-apply | Instructors not matched (Momence teachers have no email). |
| Bookings → `Booking` | momence-apply | Imported as `DROP_IN`, $0. Amounts and sources were later backfilled by `sales-apply.ts`. |
| Sales → `Payment` | `sales-map/apply.ts`, `sales-other-map/apply.ts` | Session revenue backfills bookings. Membership, product, tip, gift-card, fee, course and credit sales become standalone `Payment` rows (Provo fallback location). |
| Shelf spaces / waitlist, extra name/phone | `sheets-map.py` + `sheets-apply.ts` | From the Google Sheet, not Momence. |

**What is NOT imported**
- **Payment methods / cards on file.** Not exported or mapped; members would need to re-enter cards.
- **Waivers / signatures.** Nothing exported.
- **Gift card balances (`GiftCard` rows).** Gift-card *sales* became 744 `Payment` rows of type `GIFT_CARD`, but there are 0 `GiftCard` rows, so no redeemable balances were migrated.
- **Tips as `Tip` rows.** Imported only as 1,706 `TIP` `Payment` rows; the `Tip` table has 2 rows. So `/admin/tips` doesn't show historical tips.
- **Instructor assignment on sessions.**

**Housekeeping**
- The four `sales-*` scripts are **untracked in git**. Their headers reference `npm run sales:map` / `sales:apply` / `sales:other:*`, but **those scripts aren't in `package.json`**.
- The database contains the resulting `Payment` rows, so they have evidently been run somehow.

---

## 11. Gift cards — PARTIAL

**Issue: works**
- Two ways:
  - **Admin:** `/admin/studio-setup/gift-cards` → `POST /api/admin/gift-cards` (ADMIN, manual code).
  - **POS sale:** a `GIFT_CARD` line item auto-generates a code on order completion (`createGiftCardWithUniqueCode` in `src/lib/pos.ts`).
- **The POS-generated code is never shown or sent to anyone:** it isn't returned by the order endpoints or included in the receipt email. Staff would have to look it up in admin.

**Redeem: POS only**
- `POST /api/pos/orders/[id]/payments/gift-card` checks active status, expiry and balance, then decrements.
- The decrement and the payment insert aren't in one transaction.
- Online booking and membership checkout don't accept gift cards.

**Balance**
- Admins see it in the admin table (with a progress bar) and can edit it via `PATCH /api/admin/gift-cards/[id]`.
- The POS returns the remaining balance after a redemption.
- **Customers can't check a balance** — there's no public or customer lookup.

**Migration: not done.** See #10. 0 `GiftCard` rows exist; Momence gift-card sales are only revenue `Payment` rows.

**No online purchase.** There's no public checkout for buying a gift card.

---

## 12. SMS and email — PARTIAL: nothing is verified to send today

### SMS: Twilio was replaced by Sendblue
- Twilio survives only in a comment in `prisma/schema.prisma`; there's no Twilio package or code.
- The provider is Sendblue (`src/lib/sendblue.ts`, iMessage with SMS fallback), called through `sendSms()` in `src/lib/sms.ts`.
- **`sendSms` only calls Sendblue when `NODE_ENV === "production"`.** Otherwise it logs to the console and writes an `SmsLog` row marked `sent`.

**Code paths that send SMS**

| Trigger | Path | Content |
|---|---|---|
| Booking confirmed, reminder (24h before, via `step.sleepUntil`), cancelled | Inngest (`src/inngest/functions.ts`) | Text of the matching active `SmsAutomation` |
| Membership created, paused | Inngest | Same |
| POS receipt | Inngest | SMS fallback when the customer has no email |
| Instructor tip notification | Stripe webhook, sent directly | |
| Admin inbox reply | Direct | |
| Automation / template "test" buttons | Direct | |

**Inbound**
- `POST /api/webhooks/sendblue/inbound` handles STOP/START/HELP (suppression list) and files other messages into the inbox.
- It fails closed without `SENDBLUE_WEBHOOK_SECRET`, which is set in `.env`.
- It still has a "Temporary" diagnostic `console.log`.

**Marketing consent isn't enforced.** `kind: "marketing"` exists, but no `canSendMarketing()` check runs before sending (per the comments in `src/lib/sms.ts` and `SmsLog`). Every current send is transactional.

### Inngest: probably not delivering
- Every event except the receipt re-send goes through `sendInngestEvent()`, which **swallows failures**.
- `src/lib/inngest.ts` says `INNGEST_EVENT_KEY` "is currently the case in production" missing, and neither `INNGEST_EVENT_KEY` nor `INNGEST_SIGNING_KEY` is in `.env`.
- So the booking and membership SMS and the POS receipt most likely never fire. I can't see Vercel's env to confirm.

### Email (Resend): very little is wired up
- Only three code paths send email:
  1. The POS receipt (via Inngest)
  2. The admin inbox reply on `email`-channel conversations (hard-coded sender `hello@throwstudio.com`)
  3. The template "test" button
- **No booking, membership or password email exists.**
- `TransactionalTemplate` has an admin editor, but **nothing renders templates for real sends**, and there are 0 template rows.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` aren't in `.env`.

### Data state
- `SmsLog`: **0 rows**, so nothing has sent (or even been logged as sent) against this database.
- 5 active `SmsAutomation` rows exist (booking confirmed/reminder/cancelled, membership created/paused).

---

## 13. Inbox — NOT STARTED (tag filters, mark unread, tag a colleague)

**What exists**
- A two-pane SMS inbox: `src/app/admin/inbox/page.tsx`, `/api/admin/inbox*`, fed by the Sendblue inbound webhook.
- It filters by **segment**, not by tag (customers / leads / instructors / `plan:<slug>`), plus a name/email search.
- It tracks unread counts (`Conversation.adminUnread`, `ConversationMessage.isRead`) and shows a sidebar unread badge.

**What's missing**
- **Tag filters.** No tag field on `Conversation` or `User`, and no tag UI.
- **Mark unread.** `PATCH /api/admin/inbox/[id]` only marks read; there's no reverse.
- **Tagging or assigning a colleague.** No assignee or mention field on `Conversation` or `ConversationMessage`. (`StaffTask` has an assignee but isn't linked to conversations.)

**Other limits**
- The list is hard-filtered to `channel: "sms"`, so email conversations never show.
- Inbound messages from unknown numbers are dropped.
- Data state: 0 conversations.

---

## 14. Reporting — PARTIAL (date range yes, location no)

`/admin/reports` (`src/app/admin/reports/page.tsx`) has a shared `DateRangePicker` and five tabs.

| Tab / API | Metrics | Who can see it |
|---|---|---|
| Overview (`/api/admin/reports/overview`) | Total / drop-in / membership revenue, revenue by day stacked by type (uncommitted change), new and active members, bookings, cancellations, avg bookings per member | ADMIN |
| Revenue (`…/revenue`) | Paginated payments, totals by type (uncommitted change), refunds | ADMIN |
| Memberships (`…/memberships`) | New, cancelled, active, MRR (normalised to 30 days), by-plan breakdown, event log | ADMIN, or STAFF with `canViewMembershipReporting` |
| Attendance (`…/attendance`) | Attendance, no-shows, waitlist (labelled "approximate" in code), day/hour heatmap | ADMIN, STAFF |
| Ad tracking (`…/ad-tracking`) | UTM source/medium/campaign, conversion to first booking or purchase | ADMIN |

Also: the dashboard (`/api/admin/dashboard`: today, 7-day sparkline, MRR, activity) and tips (`/api/admin/tips`: by instructor, date range).

**Date range: works**, via `from`/`to` query params on every report route.
- Ranges are parsed as UTC day boundaries (`T00:00:00.000Z`), not Mountain Time, so day edges are off by 6–7 hours.
- The default month is computed in server-local time.

**Location filter: none.** No report route reads `locationId`, and the page doesn't use the sidebar switcher. Every figure is franchise-wide.

**Revenue from live sources is missing from these reports**
- **Stripe subscription renewals** (`invoice.payment_succeeded`) don't create `Payment` rows, so ongoing membership revenue billed by this app is missing. The 3,355 `MEMBERSHIP` payments in the database all come from the Momence backfill.
- **POS sales** appear only as `type: OTHER`, and only when the order has a customer.

---

## 15. Cancellation and freeze intake forms — NOT STARTED

- There's no form, model, or field for a cancellation reason, freeze request, or exit survey.
- Customer cancel (`/api/memberships/cancel`) and pause (`/api/memberships/pause`) are single-click POSTs from `MembershipActions.tsx` with a confirm dialog and no inputs.
- "Freeze" isn't a concept in the code. Pause is the nearest equivalent (see #7).
- The only trace is the Momence `membership-freeze-fee` sales category, imported as `Payment` rows.

---

## 16. Customer portal — PARTIAL

What a logged-in customer can do today:

| Page | See | Do |
|---|---|---|
| `/dashboard` | Membership and plan, **ticket balance**, waiver status, upcoming bookings, count | Cancel a booking (outside 2h), sign out, quick links |
| `/bookings` | Upcoming / past / cancelled bookings | Cancel, tip the instructor on past classes |
| `/bookings/[id]/tip` | | Tip $1–$100 via Stripe Checkout |
| `/membership/manage` | Status, billing period, ticket ledger, recent bookings, assigned shelf, events | Pause, resume, cancel, switch plan |
| `/membership`, `/membership/subscribe/[planId]` | Plans, joining fee, anchor-day copy | Subscribe via Stripe Checkout |
| `/account` | Profile | Edit profile and emergency contact, change password, marketing SMS/email preferences, delete account |
| `/waiver` | Active waiver | Sign |
| `/schedule`, `/book/[id]` | Sessions | Book (member credit or paid drop-in) |

**Missing**
- **Billing:** no payment history, receipts or invoices, and no Stripe Customer Portal link or card update.
- **Gift cards:** no balance check, redemption or purchase.
- **Pottery:** no piece status (#5).
- **Waitlist:** no view of your waitlist position.
- **Inbox:** no in-app message thread.
- **Registration and login:** email/password only (`/register`, `/login`), with no password reset flow.

**Imported Momence members**
- They have no password, and there's no reset flow to set one, so it isn't clear how they'd log in. I found no invite or set-password path.
- The membership actions return errors for them (no Stripe subscription, see #7).

---

## Env vars and third-party accounts

Scope: only local `.env` and `.env.local` were checked. Vercel project env vars weren't visible.

### Referenced in code, missing from `.env`

| Variable | Used by | Effect if unset |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `src/app/api/webhooks/stripe/route.ts` | Every webhook fails signature verification, so **no bookings, memberships, tips or Terminal settlements are recorded** from Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | POS manual card entry (Stripe Elements) | Manual card payments in the POS can't load |
| `RESEND_API_KEY` | `src/lib/resend.ts` | All email sends throw |
| `RESEND_FROM_EMAIL` | POS receipt | Falls back to `noreply@throw.studio`, which must be a verified Resend domain |
| `INNGEST_EVENT_KEY` | Read by the Inngest SDK (not via `process.env` in app code); `DEPLOY.md` | Events fail and are swallowed, so **no booking/membership SMS, reminders or POS receipts** |
| `INNGEST_SIGNING_KEY` | Read by the Inngest SDK for `/api/inngest`; `DEPLOY.md` | Inngest cloud can't invoke functions |

### Present but test-mode or placeholder
- **`STRIPE_SECRET_KEY` is test mode (`sk_test_…`).** There's no live key anywhere locally, and `scripts/terminal-e2e.ts` refuses non-test keys by design.
- **Active plans have placeholder Stripe prices** (`price_placeholder_monthly/plus/annual`). These are data, not env, but they block subscriptions.
- **Lehi isn't linked to Stripe Terminal** (`Location.stripeTerminalLocationId` is null). This is also data; it blocks card-reader payments at Lehi.

(Also configured, so not a gap: database, auth, Sendblue, and the Momence export credentials.)

### Config oddities
- **`TZ` is invalid.** `.env` sets `TZ="MTC"`, which isn't a valid zone; `.env.example` says `UTC`. Server-local date maths (report default ranges, for example) may behave unexpectedly.
- **Stray Better Auth variable.** `.env` has `BETTER_AUTH_SECRET`, which nothing references; the app uses NextAuth.
- **Two secret names are both fine.** `src/lib/consent.ts` reads `NEXTAUTH_SECRET ?? AUTH_SECRET`, so `AUTH_SECRET` alone is enough.
- **Documented but unused variables.** `SENDBLUE_WEBHOOK_URL` and `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID` are in `.env.example` but nothing reads them. `uploadthing` is a dependency with zero imports in `src`.

### Third-party accounts
- **Twilio:** no longer used; replaced by Sendblue.
- **Accounts that can't be confirmed from the repo:**
  - A live Stripe account and its webhook endpoint.
  - An Inngest app.
  - A Resend account with a verified sending domain.
  - Registration of the Sendblue inbound webhook. The code comments say the Sendblue dashboard "Save" flow wasn't confirmed working.
