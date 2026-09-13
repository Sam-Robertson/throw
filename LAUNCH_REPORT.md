# Launch report: launch-sept-2026

Built 2026-09-12 on branch `launch-sept-2026` (off `rich-text-editor` after committing its WIP as `a56f3a8`).

**Commits, in order.** The branch is deployable for Sept 18 after `985afda`; F and G are on top for Sept 25.

| Commit | What |
|---|---|
| `2797b57` | Phase 1: schema migration + location-scope foundation |
| `996e1c0` | Workstream A: server-side location scoping |
| `b3f3a39` | Workstream B: booking integrity |
| `e427e64` | Workstream C: repeat weekly |
| `903bf16` | Workstream D: pottery piece intake |
| `985afda` | Workstream E: POS drop-ins, tax, clay & firing, gift card codes |
| `0ad1a89` | Workstream F: set-password / forgot-password (Sept 25) |
| `d2f6f09` | Workstream G: invoice payments + import scripts (Sept 25) |
| `78a4c23` | Phase 3: merged notes + `scripts/verify-launch.ts` |

**Where things ran.** Every migration, script and test ran against a throwaway local Postgres (`throw_launch_dev`), and Stripe calls used test mode. **The Neon database was never written to**, and neither migration has been applied to it. See Manual steps §2.1 before deploying anywhere that uses Neon.

## Phase 3 verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm run lint` | Clean |
| `npm run build` | Succeeds |
| `npm run terminal:e2e` | Passes. A simulated WisePOS E reader payment with a $10 on-reader tip completed the order. Its DROP_IN line produced a CONFIRMED `Booking` with the right customer, session and amount; re-settling didn't book twice. A drop-in order with no customer was refused payment. Tax took the zero-tax fallback, because Stripe Tax is inactive on the account. |
| New API routes → 401 when signed out | Passes: `GET`/`POST /api/admin/studio-sessions`, `GET /api/admin/pieces`, `GET`/`POST /api/pieces`, `POST /api/upload` (via `scripts/verify-launch.ts` against `next start`) |
| STAFF assigned only to Lehi | 403 for `?locationId=<provo>`, 200 for Lehi, and no Provo rows in an unfiltered request (same script, real sign-in through NextAuth credentials) |
| Migrations on a fresh database | Both apply cleanly to an empty database, and `prisma migrate diff` from the migrations to `schema.prisma` reports "No difference detected". `migrate reset` was not used; I created a fresh database and dropped it instead. |

---

## 1. Workstreams

### A. Server-side location scoping (Sept 18): built

**Built**
- **Session:** `session.user.locationIds` is loaded at sign-in in `src/auth.ts` `authorize()` and passed through `src/auth.config.ts`; typed in `src/types/next-auth.d.ts`.
- **Helpers:**
  - `src/lib/locationScope.ts`: `resolveLocationScope`, `locationWhere`, `locationWhereOrUnassigned`, `scopeAllows`, `scopeAllowsUnassigned`, `forbiddenResponse`.
  - `src/lib/staffScope.ts`: `requireStaffScope`, plus the customer and membership visibility rules.
- **Scoped routes** under `src/app/api/admin/`: `dashboard`, `customers` (+`[id]`), `inbox` (+`[id]`, `[id]/messages`, `unread-count`), `tasks` (+`[id]`), `memberships` (+`[id]/events`), `tips`, `session-types` (+`[id]`).
  - STAFF asking for an unassigned studio get 403. STAFF with no assignment see nothing.
  - Dashboard payments filter on `Payment.locationId`.
  - A customer is visible to a studio if they booked there, or have a membership or plan tied to it, or have never booked.
  - Rows with no location (conversations, tasks, Momence memberships) stay visible to every studio.
- **Sendblue inbound** (`src/app/api/webhooks/sendblue/inbound/route.ts`): tags conversations by matching the receiving number to `Location.smsNumber`.
- **Switcher** (`LocationFilterContext.tsx`, `AdminNav.tsx`, `admin/layout.tsx`): STAFF see only their studios, with no All option. ADMIN defaults to All and remembers the last choice. The Provo default is removed.
- **Pages passing the selected location:** admin dashboard, customers, inbox, tasks, memberships, tips. Staff home and roster (`src/app/(staff)/**`) are location-filtered.
- **Nav:** a Pieces item was added.

**Could not verify**
- The switcher and admin pages weren't clicked through in a browser. The server-side behavior was verified by the Lehi-only STAFF test.

**Not built**
- Per-studio *outbound* SMS. Inbox replies still send from the single `SENDBLUE_FROM_NUMBER`.
- A location argument on `checkPermission` in `/api/admin/reports/memberships`. Reports were out of scope.

### B. Booking integrity (Sept 18): built

**Built**
- **New file:** `src/lib/waivers.ts`.
- **`POST /api/bookings` and `POST /api/bookings/checkout`** return 403 `{ error: "WAIVER_REQUIRED", waiverVersionId }` when the session's studio waiver is unsigned. On the member route this happens before a ticket is spent.
- **Waiver fallback:** if a studio has no active waiver, or the session has no location, the newest active waiver at any studio applies.
- **Capacity:** checkout returns 409 `SESSION_FULL` before creating the Stripe session.
- **Past sessions:** both booking routes return 400 `SESSION_IN_PAST` for sessions that have already started.
- **Waiver page and status:** `/book/[id]`, `BookingForm.tsx`, `/waiver` and `/api/waivers/status` all use the per-studio version.
- **Fixes:**
  - `/api/waivers/sign` returns 404 for an inactive or unknown version (it used to 500).
  - `/waiver` only redirects to paths on this site, which closes an open redirect.

**Could not verify**
- No HTTP or browser run of the booking routes. The waiver lookup was checked against the local database: Provo resolves to its own version, and Lehi and a session with no location fall back to it.

**Not built**
- Refunds for the last-spot race. Two customers can still both pay for the last seat; the webhook waitlists the overflow booking, and the customer is charged with no refund.

### C. Repeat weekly (Sept 18): built

**Built**
- **`src/app/api/admin/studio-sessions/route.ts`**
  - `POST` accepts `repeatWeekly: { count }` (1–12, `MAX_REPEAT_WEEKLY`).
  - It creates DST-safe weekly sessions sharing a `seriesId` and returns `{ created, skipped }`.
  - If every week was skipped, it returns 409.
- **`[id]/route.ts`:** `DELETE ?scope=series` deletes this session and every later session in the series, or nothing. If any has bookings, it returns 409 listing them.
- **Scoping:** both files are location-scoped (403 outside scope).
- **`src/app/admin/schedule/page.tsx`:** a "Repeat weekly" switch (default 4 weeks) and "Delete this and following".

**Could not verify**
- The dialogs weren't used in a browser. DST math was checked across the Nov 1 change. GET scoping was verified over HTTP.

### D. Pottery piece intake (Sept 18): built

**Built**
- **Customer pages:** `/pieces/new` (pre-fills the last attended session) and `/pieces`.
- **Admin page:** `/admin/pieces`, with filters for location, status, date and name, plus an inline status dropdown.
- **APIs:** `/api/pieces`, `/api/admin/pieces` (+`[id]`, and `?userId=` for the POS), and `/api/upload` using Vercel Blob **client uploads**.
- **Inngest:** `src/inngest/pieces.ts` (`schedulePieceIntakePrompt`, `logPieceIntakePrompt`), registered in `src/app/api/inngest/route.ts`.
- **Dashboard card** and middleware protection for `/pieces`.

**Could not verify**
- Photo upload, because there's no `BLOB_READ_WRITE_TOKEN`. Until it's set, the route returns 503 `UPLOADS_NOT_CONFIGURED` and the form submits without photos.
- The Inngest prompt, because there are no Inngest keys.
- The pages in a browser.

**Not built**
- Customer notifications (October work).
- A prompt for bookings promoted off the waitlist, because no `booking/confirmed` event fires for them.

### E. POS: bookings, tax, firing calculator (Sept 18): built

**Built**
- **Files:** `src/lib/pos.ts`, `src/lib/stripeTax.ts`, `src/config/taxCodes.ts`, `src/config/firingPrices.ts`, `src/app/api/pos/**`, `src/app/admin/pos/**` (new `FiringPanel.tsx`), `scripts/terminal-e2e.ts`.
- **Drop-ins:** list real sessions at the order's studio for the next 7 days, defaulting to today. Completing the order creates a Booking with `posOrderItemId` and fires `booking/confirmed`.
- **Customer and capacity checks:** every payment route returns 400 `CUSTOMER_REQUIRED` for a drop-in with no customer, and 409 `SESSION_FULL` before the first payment.
- **Membership tab** removed.
- **Stripe Tax:** a calculation runs per item change, and completion creates a tax transaction. If Tax is unavailable, the order is charged with zero tax and an amber warning banner shows.
- **Clay & firing tab** uses your price table; see Questions for the undefined tiers. Charges can be written back to the customer's INTAKE pieces.
- **Gift card codes** appear in the completion response, on the success screen, and on the receipt email and SMS.
- **Location permissions:** every POS `checkPermission` passes the location.
- **Voids:** voiding a completed order cancels the drop-in bookings it created.

**Could not verify**
- **Real tax.** Stripe returns `stripe_tax_inactive` even in test mode.
- **The terminal UI in a browser.**
- **Writing firing charges onto pieces.** The end-to-end test doesn't cover it.
- **Receipt delivery,** because there are no Resend or Inngest keys.

### F. Set-password and reset (Sept 25): built

**Built**
- **Pages:** `/forgot-password`, and `/set-password?token=` ("Set up your account" vs "Reset your password"). A "Forgot password?" link on `/login`.
- **Routes:** `POST /api/auth/request-reset` always returns the same 200, sends after the response, and is limited to one email per address per minute. `POST /api/auth/set-password` uses a single-use 24-hour token stored hashed in `VerificationToken`.
- **Email:** `src/lib/email/passwordSetup.ts`.
- **Invite script:** `scripts/send-password-setup.ts`, added as `members:invite`. It supports `--dry-run`, `--limit`, `--location` and `--force`, sends at most 10 per second, and **was not run**.

**Could not verify**
- Email delivery, because there's no `RESEND_API_KEY`.
- The request-reset route end to end. Its after-response step needs a real Next.js request, so only the functions it calls were tested.

### G. Stripe webhook and import scripts (Sept 25): built

**Built**
- **Invoice payments:** in `src/app/api/webhooks/stripe/route.ts`, `invoice.payment_succeeded` writes one MEMBERSHIP `Payment` per paid invoice.
  - Idempotent on `stripeInvoiceId`; $0 invoices are skipped.
  - The line breakdown goes in `metadata`, with the joining fee flagged.
  - The first invoice is handled even if it arrives before `customer.subscription.created`.
- **Lehi preorders** (and any other checkout without booking metadata) get a logged 200. **Preorders are still not saved.**
- **Import scripts:**
  - `scripts/import-gift-cards.ts` (`import:gift-cards`) and `scripts/import-waiver-signatures.ts` (`import:waivers`).
  - Both read loosely named headers and support `--dry-run`.
  - The waiver import publishes Lehi's waiver from Provo's text if Lehi has none.
  - Shared parser in `scripts/lib/csv.ts`; sample CSVs in `scripts/fixtures/`.

**Could not verify**
- **Live Stripe events.** The webhook was exercised through the real handler with locally signed events.
- **Imports against real data.** Only dry runs against the samples, plus one real waiver import against the local database. JP hasn't sent the CSVs yet.

---

## 2. Manual steps for Sam

### 2.1 Database: do this before any deploy that points at Neon

The repo had no migration history, so production needs baselining once.

1. **Confirm the baseline matches production.** It should print "No difference detected". If it doesn't, stop and send me the output.
   ```bash
   git show a56f3a8:prisma/schema.prisma > /tmp/schema-baseline.prisma
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel /tmp/schema-baseline.prisma
   ```
2. **Mark the baseline applied without running it:**
   ```bash
   npx prisma migrate resolve --applied 0_init
   ```
3. **Apply the launch migration:** `npx prisma migrate deploy`. It adds the columns and table, and fills in the Provo and Lehi structured addresses.
4. **Check which database Vercel Preview uses.** The pushed branch builds a Preview. If Preview's `DATABASE_URL` is the production Neon database, pages that read the new columns will error until steps 1–3 are done. Either run them first, or point Preview at a Neon branch.

### 2.2 Vercel environment variables

| Variable | Needed for | When |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Piece photos. Create a Blob store under the project's Storage tab. | Sept 18 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Every Inngest send: booking SMS, piece prompt, POS receipts. Also set the app URL `/api/inngest` in the Inngest dashboard. | Sept 18 |
| `STRIPE_WEBHOOK_SECRET` | All Stripe webhooks. It's missing locally; confirm it's set in Vercel. | Sept 18 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | POS manual card entry | Sept 18 |
| `RESEND_API_KEY` | Receipts, password setup and reset | Sept 25 (receipts earlier if wanted) |
| `RESEND_FROM_EMAIL` | Optional; defaults to `hello@throwartstudio.com` | — |
| `TZ` | `.env` has `TZ="MTC"`, which is invalid. Use `UTC`, or leave it unset, in Vercel. | Sept 18 |

### 2.3 Stripe dashboard
- **Activate Stripe Tax and add your Utah registration**, with Provo as the origin address. Until then POS orders are charged with zero tax and show the warning banner. Once it's active, re-run `npm run terminal:e2e`, pointed at a non-production database, to see real tax.
- **Webhook events:** make sure the endpoint subscribes to:
  - `checkout.session.completed`
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `invoice.payment_succeeded` (**not** `invoice.paid`)
  - `invoice.payment_failed`
  - `payment_intent.succeeded`
- **Terminal:** link Lehi's Stripe Terminal location in Studio setup → Card readers. `Location.stripeTerminalLocationId` is null for Lehi.

### 2.4 Data and people (before Sept 18)
- **Assign "Staff" (`staff@throw.studio`)** to a studio in Roles & Permissions. They have no assignment, so after this deploy they see nothing.
- **Grant `canUsePos` to a role** (for example Front Desk). None of the three existing STAFF roles has it, so only admins can use the POS today.
- **Ask every STAFF user to sign out and back in after deploy.** Their location access is read at sign-in.
- **Set `Location.smsNumber`** for Provo and Lehi once the two Sendblue numbers exist. There's no admin field for it yet; use SQL or Prisma Studio. Also register the inbound webhook for each number.
- **Confirm Lehi's ZIP (84043)** in the `Location` row.

### 2.5 Scripts to run for Sept 25 (none have been run against production)
- **Waivers.** Run `npm run import:waivers -- --dry-run path/to/waivers.csv`, then without `--dry-run`. It publishes Lehi's waiver from Provo's text first.
- **Gift cards.** Run `npm run import:gift-cards -- --dry-run path/to/gift-cards.csv`, then without `--dry-run`.
- **Member invites.** Run `npm run members:invite -- --dry-run`, then a small `--limit 20` batch, then the rest. This needs `RESEND_API_KEY`. It's about 7,989 customers, and at 10 per second the full run takes roughly 14 minutes.

### 2.6 DNS
- None required. `throwartstudio.com` is already verified in Resend. Vercel Blob and Inngest need no DNS.

## 3. Judgment calls

Copied from `LAUNCH_NOTES.md`. Phase 1 and integration calls first, then each workstream's own.

### Phase 1 and integration


- **Phase 1: dev database.** No Neon CLI or API key was available to create a Neon branch, and a read-only drift check against Neon was blocked by the permission classifier. All migrations and tests therefore run against a throwaway local Postgres (`throw_launch_dev`, Homebrew Postgres 15). Neon was never written to.
- **Phase 1: baseline migration.** The repo had no migration history (the schema was applied with `db push`). `prisma/migrations/0_init` was generated from `schema.prisma` as it stood at `a56f3a8`. It is **not** verified against production: Sam must run the diff under "Manual steps" before marking it applied.
- **Phase 1: how the migration was created.** `prisma migrate dev` refuses to run in a non-interactive shell (it prompts about the new unique constraints). `launch-sept-2026` was produced with `prisma migrate diff --from-migrations … --to-schema-datamodel …` against a local shadow database, then applied with `migrate deploy`. The resulting SQL is the same as what `migrate dev` would write.
- **Phase 1: Location addresses.** The migration adds `addressLine1`, `city`, `state` and `postalCode`, and backfills Provo (308 E 300 S, Provo, UT 84606) and Lehi by exact match on the existing address strings. Lehi's ZIP **84043 is inferred** from "4275 N Thanksgiving Way Lehi Utah" and needs confirming.
- **Phase 1: password tokens.** Per Sam, `VerificationToken` is reused (stores a SHA-256 hash of the token). No `User.passwordSetupToken` or `passwordSetupExpires` columns were added.
- **Phase 1: `WaiverSignature.signedAt`** already had no default, so imported dates can be set explicitly. No change needed.
- **Phase 1: shared foundation built serially.** `src/lib/locationScope.ts`, the `locationIds` session field (`src/types/next-auth.d.ts`, `src/auth.config.ts`) and the StaffRoleAssignment lookup in `authorize()` (`src/auth.ts`) were written in Phase 1, not by Workstream A. C, D and E import them, so they had to exist before the parallel phase started. The lookup lives in `authorize()` because `auth.config.ts` also runs in the Edge middleware, where Prisma can't run.
- **Phase 1: locationIds refresh.** `locationIds` is captured at sign-in. Existing sessions carry no `locationIds`, so STAFF on those sessions see nothing until they sign in again.
- **Ownership: studio-sessions files.** Workstreams A and C both needed `src/app/api/admin/studio-sessions/route.ts` and `[id]/route.ts`. C owns both files outright and applies A's scoping (`resolveLocationScope`) there, along with `src/app/admin/schedule/**`.
- **Ownership: other reassignments.**
  - D's nav item and the Inngest registration go through cross-workstream notes; nobody but A edits `AdminNav.tsx`.
  - `src/app/api/inngest/route.ts` (function registration) and `package.json` are G's.
  - `src/app/(staff)/**` is A's.
  - `checkPermission` call sites inside `src/app/api/pos/**` are E's.

- **Phase 3: A's suggested refactor not applied.** A suggested C and D replace their guards with its new `requireStaffScope()` helper. Not applied: both already scope with `resolveLocationScope`, and `scripts/verify-launch.ts` confirms C's behaviour. It would be a refactor with no change in behaviour.
- **Phase 3: upload route auth order.** `POST /api/upload` returned 503 `UPLOADS_NOT_CONFIGURED` to unauthenticated callers sending a malformed body. It now requires a session for everything except Vercel Blob's signed `blob.upload-completed` callback, and checks that before the configuration check.
- **Phase 3: dev database for verification.** The terminal e2e, the build and `scripts/verify-launch.ts` all ran against the local `throw_launch_dev` database, per the Phase 1 note above.


### Workstream A


- **Memberships with no location are visible to every studio.** This covers the Momence imports, 445 of 449. Hiding them would put every studio's member counts near zero. The same applies on the dashboard and in the memberships list.
- **Unassigned tasks and conversations are visible to every studio**, meaning `StaffTask.locationId` or `Conversation.locationId` is null. All existing tasks are unassigned.
- **Class types match strictly.** A STAFF user doesn't see class types with no studio in the list, which preserves the previous behavior of `?locationId=`. Individual GET/PATCH on a location-less class type is allowed.
- **Sessions with no location** (7 old ones) drop out of single-studio views and the staff roster.
- **Staff home permissions aren't location-specific.** The home page still calls `checkPermission` without a location ("at any assigned studio"), since there isn't a single location in hand. Only the roster page, which has the session's studio, passes one.
- **The inbox badge ignores the switcher.** The unread count covers the user's whole scope, and `InboxCountContext` is unchanged.
- **Session scope changes need a fresh sign-in.** `locationIds` is captured at sign-in (Phase 1), so a changed StaffRoleAssignment takes effect on the next sign-in, and STAFF on pre-deploy sessions see nothing until they sign in again.


### Workstream B


- **Fallback waiver.** A location with no active WaiverVersion, or a session with `locationId = null`, requires the **most recently published active version at any location**. With Lehi unpublished, Lehi bookings require Provo's waiver until G publishes Lehi's. Previously, sessions with no location required no waiver at all. If no location has an active waiver, nothing is required (unchanged).
- **Past sessions rejected on both routes.** Sessions whose `startsAt <= now` get 400 `SESSION_IN_PAST` on **both** booking routes, not just checkout, so members can't book a past session either. The book page shows the matching state.
- **No paying to join a waitlist.** Paid drop-ins can no longer join a waitlist. The old UI offered "Pay and Join Waitlist" when a session was full, which contradicts `SESSION_FULL`. Members can still join a waitlist for free through `/api/bookings` (unchanged).
- **Signing validation.** `/api/waivers/sign` now rejects inactive or unknown versions (404). Previously an unknown id hit the foreign key and returned a 500.
- **Callback URL.** `/waiver` only accepts relative same-site paths (`/…`, not `//…`), which closes an open redirect.
- **Status response.** In `/api/waivers/status`, `waiverVersionId` historically returned the *signature* id when signed. It now returns the version id. Nothing in `src` calls this route.
- **Unused component.** `src/app/(customer)/waiver/_components/WaiverSignForm.tsx` is unused. Left untouched.


### Workstream C


- **Series delete counts every booking.** Any booking row blocks it, **including CANCELLED** ones: `Booking.studioSessionId` is a required foreign key with no cascade, so the delete would fail on them anyway. This matches the single-session delete. The `deleteMany` also re-checks `bookings: none` at delete time.
- **"This and following"** means sessions in the series with `startsAt >= this session's startsAt`, including this one even if it's in the past.
- **Default repeat count is 4** (spec max 12).
- **Scope comes from the class type.** New sessions take `SessionType.locationId`, so that's what POST checks. A class type with a null location can only be scheduled by ADMIN.
- **All-skipped repeat returns 409** with the skipped list rather than a 201 with nothing created.
- **The page mirrors `MAX_REPEAT_WEEKLY = 12`** as its own constant (it can't import a server route). The API is the enforcer.


### Workstream D


- **Client uploads instead of server `put()`.** Vercel limits function request bodies to 4.5 MB, so routing photos through `/api/upload` with `put()` would fail for ordinary phone photos. The route implements the Blob client-token handshake instead, and the browser uploads straight to Blob. The 5-per-entry cap is enforced when the Piece is created, not per upload.
- **Photo size cap:** 10 MB each.
- **Validating the session:** any non-cancelled booking of the caller counts, NO_SHOW included, so a mistaken no-show mark doesn't block logging.
- **No location at all:** 400 with a message pointing to the session picker or the front desk. A customer with no bookings anywhere can't self-log.
- **Admin defaults.** The list defaults to status INTAKE with no date filter (toggle it on), capped at the 300 most recent rows.
- **The prompt uses `step.sleepUntil`,** like the existing reminder. A booking confirmed after its session ended prompts immediately.
- **Bookings promoted from WAITLIST don't get a prompt,** because no `booking/confirmed` event fires for them (existing behaviour).


### Workstream E


- **Drop-in quantity is fixed at 1**, and a session can appear once per order. A Booking is one seat for one user (`posOrderItemId` is unique), and a POS drop-in books the order's customer. A second person means a second order with that person as the customer.
- **The capacity re-check runs only before the first payment.** On a split payment, refusing the second leg would strand a half-paid order. If a session fills between legs, completion creates a WAITLIST booking and adds an order note instead.
- **Stripe Tax is recalculated on item changes only** (add, quantity/discount change, delete), not on tip or customer changes, since those don't change tax. `recalculateOrderTotals` sums the stored per-line tax, so tip-only updates and Terminal settlement make no Stripe call. The warning banner therefore updates only on item changes and resets on a new or resumed order.
- **In-person tax address.** The studio's own structured address is sent as the customer address, with `address_source: "shipping"`.
- **Firing lines covering several pieces.** When one firing line is attached to several Piece rows, `weightOz` and `chargedCents` are split evenly, with the remainder on the oldest piece.
- **What the weight field means per tier.**
  - Experience: weight per piece. Price = band × count.
  - Member and course: total weight. The count is recorded but not priced.
  - Clay: count = number of bags.
- **The course 15 lb allowance is checked per weigh-in only.** Nothing tracks a student's running total across the course.
- **$0-only orders.** An order made up only of $0 lines (e.g. a course firing for the record) can't be completed, because no payment route accepts $0. Add the $0 line to an order that has other items. This didn't seem worth widening the payment routes for.
- **POS revenue in reports.** The mirrored `Payment` row for a POS order is still a single `type: OTHER` row for the whole order. A POS drop-in's revenue shows as "other" in Revenue reports, not "drop-in". Splitting it is out of E's scope.
- **Voiding a completed order doesn't reverse the Stripe Tax transaction.** No transaction id is stored, and void also doesn't refund money. It does cancel the drop-in bookings the order created. Firing charges written to pieces aren't reverted either.
- **Orders GET scoping.** Beyond passing `locationId` to `checkPermission`, the order-history list is scoped to STAFF's assigned locations via `resolveLocationScope`, so Lehi staff don't see Provo orders.
- **STAFF can't use the POS yet.** The three existing STAFF roles have no `canUsePos` key, so today only ADMIN can use the POS. That's role configuration, not code; assign it in Roles & Permissions.


### Workstream F


- **Abuse protection** is at most one email per address per 60 seconds, measured from the current token's issue time (`VerificationToken` has no createdAt, so issue time = expires − 24h). There's no IP rate limit (no infrastructure for it).
- **Only the latest link works.** A new request replaces the previous link. Someone who clicks an older email gets "This link isn't valid" and can request another.
- **Set-password heading** ("Set up your account" vs "Reset your password") is decided server-side when the /set-password page loads, from the token. There's no public endpoint that could reveal whether an email has an account.
- **After setting a password** the page shows a success state with a "Sign in" button to /login. It doesn't sign them in automatically (the simplest option, and easy to change).
- **Existing sessions aren't revoked on reset.** NextAuth uses JWT sessions and there's no revocation list, so other devices stay signed in until their JWTs expire.
- **Email matching is case-insensitive** (`mode: "insensitive"`), because register doesn't lowercase emails.
- **The invite script refuses to run for real without `RESEND_API_KEY`,** rather than creating links nobody receives. `--location` uses the Phase 0 customer-to-location rule; memberships whose location and plan location are both null don't count.


### Workstream G


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


## 4. Questions for Sam

These are decisions I deferred instead of guessing. Each has a working default in the code today.

**Needs an answer before Sept 18**
1. **POS drop-ins and waivers.** Should a front-desk drop-in require a signed waiver? Online bookings do; the POS currently doesn't. It's a one-call change (`findUnsignedWaiver` in `src/lib/waivers.ts`).
2. **Who can use the POS?** No STAFF role has `canUsePos`. Which roles should get it (Front Desk?), and should instructors?
3. **Momence memberships with no location.** 445 of 449 memberships have no studio, so they're currently visible to both studios' staff. Is that OK, or should I backfill them to Provo so Lehi staff don't see Provo's members?
4. **Lehi ZIP.** Is 84043 correct for 4275 N Thanksgiving Way? Stripe Tax uses it.

**For JP (pricing and tax), before the numbers go live**
5. **Tax codes.** `src/config/taxCodes.ts` uses `txcd_99999999` for retail, custom and clay/firing, with gift cards, drop-ins and memberships non-taxable. Correct?
6. **Experience pieces over 2 lb** have no price. The POS refuses them and asks for a manual custom price. What should they cost?
7. **Member weigh-and-pay rounding.** It's currently exact cents from ounces (a 13 oz piece under 12 in is $0.81). Round up to the next half pound or the next dollar instead?
8. **Recycled clay at $0.50/lb** came from a deleted Momence product. Is it still sold, and at that price?
9. **Pro price.** The website shows $110/month and the seed file $90. Which is right before Oct 25?

**Can wait until after Sept 18**
10. **Per-studio outbound SMS.** Once the two Sendblue numbers exist, should inbox replies come from the conversation's studio number? Today everything sends from one number.
11. **Paid drop-in that loses the last seat.** Should it auto-refund? Today the customer is charged and waitlisted.
12. **POS drop-in revenue** reports as "other". Should it count as drop-in revenue?
13. **Voided POS orders** don't reverse the Stripe Tax transaction. Should they? This only matters once Tax is on.
14. **Invoice payments with no studio.** A membership or plan with no location records against the oldest active studio, which is Provo. OK?
15. **Waitlist promotions** don't trigger the piece-intake prompt. Should they?
