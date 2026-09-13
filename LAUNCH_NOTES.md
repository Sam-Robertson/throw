# Launch notes: launch-sept-2026

Working notes for the Sept 18 / Sept 25 launch build. During Phase 2, each
workstream writes to its own file under `launch-notes/<letter>.md` (seven
agents editing one file at once would clobber each other). Those files are
merged into this one in Phase 3.

## Judgment calls

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
- **Follow-up (Sam's answers, 2026-09-12): POS waivers.** `checkOrderPayable` checks the waiver per drop-in, only before the first payment, like the seat check. A waiver can't become unsigned mid-order, so later legs of a split payment aren't re-checked. Staff can't sign on the customer's behalf; that's raised as Question 16.
- **Follow-up: POS access.** `canUsePos` is implicit for STAFF but still location-scoped: STAFF must be assigned to the order's studio, and STAFF with no assignment still can't use the POS. The `canUsePos` key stays in role JSON and in the staff-roles API for compatibility; only the Roles page toggle was removed.
- **Follow-up: membership location.**
  - The backfill is its own migration, not an edit to `launch-sept-2026`. That migration was already applied to the local databases, and editing it would change its checksum.
  - Provo is identified by the postal code `84606` that the previous migration sets.
  - The webhook's "default studio" is the oldest active location, which is Provo in production (verified read-only). It's shared by new memberships and by invoice payments.
- **Phase 3: dev database for verification.** The terminal e2e, the build and `scripts/verify-launch.ts` all ran against the local `throw_launch_dev` database, per the Phase 1 note above.

## Cross-workstream edits needed

Status of every request from `launch-notes/*.md`, as applied in Phase 3:

- **D: register the piece functions in `src/app/api/inngest/route.ts`.** Applied.
- **D: add `/pieces` to the signed-in list in `src/middleware.ts`.** Applied.
- **D: "Pieces" nav item.** Done by A in `AdminNav.tsx`.
- **E: gift card codes and tax on the POS receipt email and SMS in `src/inngest/functions.ts`.** Applied as written.
- **F: add the `members:invite` script to `package.json`.** Done by G with F's exact line.
- **A → C and D: use `requireStaffScope`.** Not applied (see Judgment calls).
- **B → E: require a waiver for POS drop-ins.** Not applied. Deferred to Sam (see LAUNCH_REPORT.md, Questions).
- **B → G: the Lehi WaiverVersion G publishes must be `isActive: true`.** Confirmed in G's script.
- **A follow-up (unowned): per-studio SMS reply numbers and a location-aware `checkPermission` in `/api/admin/reports/memberships`.** Not done; reported.

---

# Per-workstream notes (merged verbatim from launch-notes/)


---

# Workstream A: server-side location scoping

## Built

**Scoping helpers**
- `src/lib/locationScope.ts` (extended; existing signatures unchanged)
  - `locationWhereOrUnassigned` now returns nothing for an empty scope, so a STAFF user with no assignment doesn't see unassigned rows.
  - New `scopeAllowsUnassigned(scope, locationId)`: the single-row check where null is visible to any non-empty scope.
- `src/lib/staffScope.ts` (new, server-only, because it imports `auth` and `prisma`)
  - `requireStaffScope(requested?)` is the `requireStaff()` guard plus scope: 401 with no session, 403 for non-staff or an unassigned location.
  - `customerScopeWhere` / `customerVisible`: booking at a scoped studio, OR a membership (or its plan) tied to one, OR no bookings at all.
  - `membershipScopeWhere`: membership or plan location in scope, OR neither set (Momence imports) visible to all.

**Location switcher and nav**
- `src/app/admin/_components/LocationFilterContext.tsx`
  - Takes `role` and `assignedLocationIds` props (passed from `src/app/admin/layout.tsx`, which reads the session).
  - STAFF see only assigned studios, with no All option and a default of the first assigned.
  - ADMIN defaults to All. localStorage still remembers the last choice; invalid stored ids are dropped. The hard-coded Provo default is gone.
  - New exports: `canSelectAll`, `locationQueryValue()`, `withLocationParam()`.
- `src/app/admin/_components/AdminNav.tsx`: the switcher hides "All Locations" when `!canSelectAll`, and a **Pieces** link (`/admin/pieces`) is appended under Manage, after Waivers.

**Scoped API routes** (`?locationId=` narrows; absent or `__all__` means the full scope)
- **Dashboard:** `src/app/api/admin/dashboard/route.ts`
  - Payment is scoped on `Payment.locationId`.
  - Bookings and sessions are scoped via the session's `locationId`.
  - StaffTask uses `locationId`, with null visible to all.
  - Memberships use `membershipScopeWhere`.
- **Customers:** `src/app/api/admin/customers/route.ts` (list and typeahead) and `customers/[id]/route.ts` (GET/PATCH return 403 when not visible, 404 when missing).
- **Inbox:**
  - `inbox/route.ts`: GET is scoped, with null `locationId` visible to all. POST tags the conversation with the requested studio or the user's only studio.
  - `inbox/[id]/route.ts` and `inbox/[id]/messages/route.ts`: 403 outside scope.
  - `inbox/unread-count/route.ts`: sums over the user's whole scope.
- **Tasks:**
  - `tasks/route.ts`: GET is scoped, with null visible to all. POST accepts an optional `locationId`, which must be in scope.
  - `tasks/[id]/route.ts`: PATCH returns 403 outside scope.
- **Memberships:** `memberships/route.ts` and `memberships/[id]/events/route.ts` (returns 404 when outside scope).
  - pause, cancel and adjust-tickets are ADMIN-only, so they're unrestricted and unchanged.
- **Tips:** `tips/route.ts` (ADMIN-only) applies `?locationId=` to `Tip.locationId`. The payout routes are ADMIN-only and unchanged.
- **Session types:**
  - `session-types/route.ts`: GET matches `locationId` strictly. POST checks that the target studio is in scope.
  - `session-types/[id]/route.ts`: GET/PATCH/DELETE return 403 outside scope, and PATCH also checks any new `locationId`.

**Sendblue inbound:** `src/app/api/webhooks/sendblue/inbound/route.ts`
- Matches the normalized `to_number` to `Location.smsNumber`.
- If there's a match, it prefers that studio's conversation, otherwise adopts an unassigned one and sets its `locationId`, otherwise creates a new one with the `locationId`.
- If there's no match, it behaves as before and the conversation stays unscoped.

**Pages**
- These pages pass the selected studio and wait for the switcher to load before fetching:
  - `src/app/admin/page.tsx`
  - `src/app/admin/customers/page.tsx` (also resets to page 1 when the studio changes)
  - `src/app/admin/inbox/page.tsx`
  - `src/app/admin/tasks/page.tsx` (new tasks are tagged with the selected studio)
  - `src/app/admin/memberships/page.tsx`
  - `src/app/admin/tips/_components/AdminTipsClient.tsx`
- `class-types/page.tsx` already did this; unchanged.
- `src/app/(staff)/staff/page.tsx`: today's sessions are filtered to the staff member's locations. With no assignment it shows "You're not assigned to a studio yet…".
- `src/app/(staff)/staff/sessions/[id]/page.tsx`
  - Shows a blocked message when the session's studio is out of scope.
  - `checkPermission` now receives the session's `locationId`.
  - The waiver lookup prefers that studio's active version and falls back to any active version.

## Could not verify

- **No runtime test was run.** I didn't sign in as STAFF or run the dev server; the Lehi-only STAFF check is the Phase 3 script. Type-check and lint are clean for these files.
- **Sendblue `to_number` format.** I assumed Sendblue sends `to_number` in a form `normalizePhone` turns into E.164 matching `Location.smsNumber`. That can't be tested until the numbers exist, and `smsNumber` must be stored in E.164.

## Judgment calls

- **Memberships with no location are visible to every studio.** This covers the Momence imports, 445 of 449. Hiding them would put every studio's member counts near zero. The same applies on the dashboard and in the memberships list.
- **Unassigned tasks and conversations are visible to every studio**, meaning `StaffTask.locationId` or `Conversation.locationId` is null. All existing tasks are unassigned.
- **Class types match strictly.** A STAFF user doesn't see class types with no studio in the list, which preserves the previous behavior of `?locationId=`. Individual GET/PATCH on a location-less class type is allowed.
- **Sessions with no location** (7 old ones) drop out of single-studio views and the staff roster.
- **Staff home permissions aren't location-specific.** The home page still calls `checkPermission` without a location ("at any assigned studio"), since there isn't a single location in hand. Only the roster page, which has the session's studio, passes one.
- **The inbox badge ignores the switcher.** The unread count covers the user's whole scope, and `InboxCountContext` is unchanged.
- **Session scope changes need a fresh sign-in.** `locationIds` is captured at sign-in (Phase 1), so a changed StaffRoleAssignment takes effect on the next sign-in, and STAFF on pre-deploy sessions see nothing until they sign in again.

## Cross-workstream edits needed

- **For C:** in `src/app/api/admin/studio-sessions/route.ts` and `[id]/route.ts`, use `requireStaffScope(searchParams.get("locationId"))` from `@/lib/staffScope` in place of the local `requireStaff()`, and add `...locationWhere(guard.scope)` to the GET where. For single sessions, check `scopeAllows(guard.scope, session.locationId)`. For POST, check the session type's `locationId` with `resolveLocationScope(guard.session, locationId)`.
- **For D:** `/api/admin/pieces` can use the same `requireStaffScope` + `locationWhere` (`Piece.locationId` is required). The nav link to `/admin/pieces` is already in place.
- **Follow-up, not assigned to any workstream:**
  - Admin inbox replies (`inbox/[id]/messages`) still go out from the single `SENDBLUE_FROM_NUMBER`, whatever the conversation's studio. Per-studio sending needs `src/lib/sendblue.ts` / `src/lib/sms.ts` to accept a from-number (e.g. the conversation's `Location.smsNumber`).
  - `/api/admin/reports/memberships` still calls `checkPermission` without a location. Reports were out of scope.


---

# Workstream B: booking integrity

## Built

- **`src/lib/waivers.ts` (new).** The shared lookup for which waiver applies to a session:
  - `getApplicableWaiver(locationId)`: the location's active version, or the fallback.
  - `resolveWaiverForVersion(versionId)`: stale links resolve to whatever now applies at that version's location.
  - `findUnsignedWaiver(userId, locationId)`, `hasSignedWaiver`.
  - `waiverSignUrl`, `safeCallbackUrl`.
- **`src/app/api/bookings/route.ts` (member POST).**
  - Returns 400 `SESSION_IN_PAST` if the session has started.
  - Returns 403 `{ error: "WAIVER_REQUIRED", waiverVersionId }`. This check runs before the membership lookup and before `consumeTicket`, so no ticket is spent on a refused booking.
- **`src/app/api/bookings/checkout/route.ts` (paid drop-in).** Before a Stripe Checkout session is created, it returns:
  - 400 `SESSION_IN_PAST`
  - 403 `WAIVER_REQUIRED`
  - 409 `{ error: "SESSION_FULL" }` (CONFIRMED count >= capacity)
- **`src/app/(customer)/book/[id]/page.tsx`.**
  - The redirect uses the same per-location lookup: `/waiver?versionId=…&callbackUrl=/book/<id>`.
  - Sessions with no location are now covered too (see the fallback below).
  - A new "This session has started" state.
- **`src/app/(customer)/book/[id]/_components/BookingForm.tsx`.**
  - Customer-facing messages for `WAIVER_REQUIRED` (with a "Sign the waiver" link), `SESSION_FULL` and `SESSION_IN_PAST`.
  - When the session is full, the paid drop-in button is replaced by "This session is full. See other times".
- **`src/app/(customer)/waiver/page.tsx`.**
  - Honors `?versionId=` (or `?locationId=`) and names the studio whose waiver is being signed.
  - The callback URL is restricted to same-site paths.
- **`src/app/api/waivers/status/route.ts`.** Accepts `?versionId=` or `?locationId=` and adds `locationId` to the response.
- **`src/app/api/waivers/sign/route.ts`.** Refuses (404) signing a version that doesn't exist or is no longer active.
- **`src/components/shared/WaiverSignatureForm.tsx`.** No change needed. It already posts whichever `waiverVersionId` the page passes.

## Could not verify

- **No end-to-end run.** No browser run or live Stripe Checkout; no `next dev` or build in this phase.
- **What was checked.** `tsc` is clean for B's files. The lookup was exercised against the local DB (`throw_launch_dev`):
  - Provo resolves to its own v1.
  - Lehi (no version) and a session with no location both resolve to the Provo fallback.
  - `safeCallbackUrl` rejects `https://…` and `//…`.
- **Route tests.** The route handlers weren't called over HTTP. The Phase 3 build and route tests should cover them.
- **Last-spot race.** Capacity is checked before payment but nothing is reserved, so two customers can still both pass the check for the last spot. The webhook's existing capacity check (owned by G, unchanged) still waitlists the overflow, and that customer is still charged. Refunding that case is not built.

## Judgment calls

- **Fallback waiver.** A location with no active WaiverVersion, or a session with `locationId = null`, requires the **most recently published active version at any location**. With Lehi unpublished, Lehi bookings require Provo's waiver until G publishes Lehi's. Previously, sessions with no location required no waiver at all. If no location has an active waiver, nothing is required (unchanged).
- **Past sessions rejected on both routes.** Sessions whose `startsAt <= now` get 400 `SESSION_IN_PAST` on **both** booking routes, not just checkout, so members can't book a past session either. The book page shows the matching state.
- **No paying to join a waitlist.** Paid drop-ins can no longer join a waitlist. The old UI offered "Pay and Join Waitlist" when a session was full, which contradicts `SESSION_FULL`. Members can still join a waitlist for free through `/api/bookings` (unchanged).
- **Signing validation.** `/api/waivers/sign` now rejects inactive or unknown versions (404). Previously an unknown id hit the foreign key and returned a 500.
- **Callback URL.** `/waiver` only accepts relative same-site paths (`/…`, not `//…`), which closes an open redirect.
- **Status response.** In `/api/waivers/status`, `waiverVersionId` historically returned the *signature* id when signed. It now returns the version id. Nothing in `src` calls this route.
- **Unused component.** `src/app/(customer)/waiver/_components/WaiverSignForm.tsx` is unused. Left untouched.

## Cross-workstream edits needed

- **Workstream E (POS drop-in bookings in `maybeCompletePosOrder`).** Waiver enforcement is only on the customer-facing routes. If POS drop-ins should also require a signed waiver, E can call `findUnsignedWaiver(order.customerId, session.locationId)` from `src/lib/waivers.ts`. Whether front-desk sales should require a waiver is a question for Sam, so nothing was requested of E by default.
- **Workstream G (`scripts/import-waiver-signatures.ts`).** The Lehi WaiverVersion G publishes must have `isActive: true`. From then on, `getApplicableWaiver(lehiId)` returns it instead of the Provo fallback, and customers who signed only Provo's will be asked to sign Lehi's when they book there. That is intended.


---

# Workstream C: repeat weekly and studio-sessions scoping

## Built

- **`src/app/api/admin/studio-sessions/route.ts`**
  - `requireStaff()` now returns the session.
  - GET scopes through `resolveLocationScope(session, ?locationId)` and `locationWhere`. STAFF asking for an unassigned location gets 403. STAFF with no param gets only their locations. STAFF with no assignment gets an empty list.
  - POST returns 403 when the class type's location is out of scope.
  - POST accepts `repeatWeekly: { count }` (1–12, `MAX_REPEAT_WEEKLY = 12`, 400 otherwise). It creates one session per week on the same weekday and Mountain wall-clock time, all sharing a `seriesId` (`crypto.randomUUID()`), and skips slots that already have a session of that type at that start time.
    - Response: `201 { created, skipped: [{ startsAt, reason }], seriesId }`.
    - If every slot was taken: `409 { error, created: [], skipped, seriesId: null }`.
  - Without `repeatWeekly`, the single-create response shape is unchanged (201 with the session, 409 on duplicate).
  - POST now also validates the `localDate`/`localTime` format and that capacity is at least 1. Malformed input previously produced an Invalid Date.
- **`src/app/api/admin/studio-sessions/[id]/route.ts`**
  - PATCH and DELETE load the session and return 404 if it's missing and 403 if it's out of scope. DELETE on a missing id used to 500.
  - `DELETE ?scope=series` deletes this session and every later session in its series, all or nothing. If any of them has bookings, it returns `409 { error, sessionsWithBookings: [{ id, startsAt, bookingCount }] }` and deletes nothing. On success: `200 { deleted, ids }`.
  - Any other `scope` value returns 400. Plain DELETE is unchanged.
- **`src/app/admin/schedule/page.tsx`**
  - The add dialog has a "Repeat weekly" switch and a number-of-weeks field (default 4, max 12, validated), and the button label shows the count.
  - After a repeat create, the dialog shows how many were created and which weeks were skipped, then reloads the week.
  - The edit dialog shows "Part of a weekly series" and a "Delete this and following" action behind a confirm dialog. A 409 lists the sessions that have bookings.
  - It still uses only `useLocationFilter` / `ALL_LOCATIONS` / `selectedLocationId` from `LocationFilterContext`.

## Could not verify

- I didn't exercise the routes over HTTP: no dev server or build is allowed in Phase 2, and the routes need a NextAuth session. The Lehi-only STAFF check is left for the Phase 3 script.
- DST was verified with the date arithmetic alone: a Tue 6:30 pm series from Oct 20 to Nov 10, 2026 stays at 18:30 Mountain across the Nov 1 fall-back (00:30Z becomes 01:30Z).
- `tsc` shows no errors in my files. `eslint` is clean on `src/app/api/admin/studio-sessions` and `src/app/admin/schedule`.

## Judgment calls

- **Series delete counts every booking.** Any booking row blocks it, **including CANCELLED** ones: `Booking.studioSessionId` is a required foreign key with no cascade, so the delete would fail on them anyway. This matches the single-session delete. The `deleteMany` also re-checks `bookings: none` at delete time.
- **"This and following"** means sessions in the series with `startsAt >= this session's startsAt`, including this one even if it's in the past.
- **Default repeat count is 4** (spec max 12).
- **Scope comes from the class type.** New sessions take `SessionType.locationId`, so that's what POST checks. A class type with a null location can only be scheduled by ADMIN.
- **All-skipped repeat returns 409** with the skipped list rather than a 201 with nothing created.
- **The page mirrors `MAX_REPEAT_WEEKLY = 12`** as its own constant (it can't import a server route). The API is the enforcer.

## Cross-workstream edits needed

- None.


---

# Workstream D: Pottery piece intake

## Built

- **Shared helpers:** `src/app/api/pieces/_shared.ts`. Status labels, photo limits, and blob URL ownership checks. No runtime Prisma import, so client components can use it.
- **Photo upload:** `src/app/api/upload/route.ts`.
  - `GET` returns whether uploads are configured (401 unauthenticated).
  - `POST` is the Vercel Blob client-upload token exchange (`handleUpload`). It returns 503 `{ error: "UPLOADS_NOT_CONFIGURED" }` without `BLOB_READ_WRITE_TOKEN`, and 401 for a token request without a session.
  - Uploads must use the `pieces/<userId>/` prefix, JPEG/PNG/WebP/HEIC only, 10 MB max each.
- **Customer API:** `src/app/api/pieces/route.ts`.
  - `GET`: the caller's own pieces.
  - `POST`: creates a Piece with status `INTAKE`.
  - `locationId` comes from the chosen session (which must be one of the caller's non-cancelled bookings). Otherwise it's the location of their most recent past booking, then of any booking. Otherwise 400.
  - Photo URLs must be Vercel Blob URLs under the caller's prefix, 5 max.
- **Customer pages**
  - `src/app/(customer)/pieces/page.tsx`: the pieces list with status chip and photo thumbnails.
  - `src/app/(customer)/pieces/new/page.tsx` + `_components/PieceForm.tsx`: the intake form.
    - Honours `?session=`, and otherwise pre-fills the most recent past CONFIRMED booking's session.
    - Session picker covers the last 60 days.
    - When uploads aren't configured, the form shows a note and still submits without photos.
- **Admin API**
  - `src/app/api/admin/pieces/route.ts` (`GET`): supports `?locationId`, `?status`, `?from`/`?to` (Mountain dates, inclusive), `?q` (customer name/email), `?userId`. Scoped with `resolveLocationScope`; returns the fields Workstream E needs.
  - `src/app/api/admin/pieces/[id]/route.ts` (`PATCH`): status only; 403 outside scope.
- **Admin page:** `src/app/admin/pieces/page.tsx` + `_components/AdminPiecesClient.tsx`.
  - Filters: location (from the sidebar switcher), status (defaults to INTAKE), customer search, and an optional date range.
  - Inline status dropdown with optimistic update.
- **Inngest:** `src/inngest/pieces.ts`.
  - `schedulePieceIntakePrompt` triggers on `booking/confirmed`. It sleeps until `endsAt + PIECE_PROMPT_DELAY_MINUTES` (0), re-checks the booking is still CONFIRMED and the session isn't cancelled, then sends `piece/intake.prompt { bookingId }`.
  - `logPieceIntakePrompt` is a stub that only logs.
- **Dashboard:** `src/app/(customer)/dashboard/page.tsx` gets a "Your pieces" card with "Log your pieces" and "View my pieces" buttons.

## Could not verify

- **Photo uploads, end to end.** There's no `BLOB_READ_WRITE_TOKEN`. Only the not-configured path (503, then the form falls back to no photos) is exercised by code reading and tsc. Vercel's `onUploadCompleted` callback never reaches localhost, but nothing depends on it.
- **HEIC thumbnails.** HEIC photos are accepted, but only Safari renders them. On other browsers the thumbnails show a blank avatar, though the link still opens the file.
- **The Inngest prompt.** Not run: Inngest keys are missing.
- **Nothing was tested in a browser.** No `next dev` per the rules.

## Judgment calls

- **Client uploads instead of server `put()`.** Vercel limits function request bodies to 4.5 MB, so routing photos through `/api/upload` with `put()` would fail for ordinary phone photos. The route implements the Blob client-token handshake instead, and the browser uploads straight to Blob. The 5-per-entry cap is enforced when the Piece is created, not per upload.
- **Photo size cap:** 10 MB each.
- **Validating the session:** any non-cancelled booking of the caller counts, NO_SHOW included, so a mistaken no-show mark doesn't block logging.
- **No location at all:** 400 with a message pointing to the session picker or the front desk. A customer with no bookings anywhere can't self-log.
- **Admin defaults.** The list defaults to status INTAKE with no date filter (toggle it on), capped at the 300 most recent rows.
- **The prompt uses `step.sleepUntil`,** like the existing reminder. A booking confirmed after its session ended prompts immediately.
- **Bookings promoted from WAITLIST don't get a prompt,** because no `booking/confirmed` event fires for them (existing behaviour).

## Cross-workstream edits needed

1. **`src/app/api/inngest/route.ts`** (G / integration): register the two functions.
   ```ts
   import { schedulePieceIntakePrompt, logPieceIntakePrompt } from "@/inngest/pieces";
   // ...inside serve({ functions: [ ... ] }):
       schedulePieceIntakePrompt,
       logPieceIntakePrompt,
   ```
2. **`src/app/admin/_components/AdminNav.tsx`** (A): a "Pieces" item linking to `/admin/pieces`. A was asked to add it; please confirm.
3. **`src/middleware.ts`** (optional, unowned): `/pieces` isn't in the middleware's signed-in-only list. Both pages redirect to `/login?callbackUrl=…` themselves, so nothing is exposed. For consistency, add `pathname.startsWith("/pieces") ||` to the `/dashboard`, `/account` block.
4. **Workstream E (POS):** DROP_IN bookings created at POS completion should go through `sendInngestEvent({ name: "booking/confirmed", ... })`, so walk-ins also get the piece prompt. E's brief already says to.
5. **Env (manual):** `BLOB_READ_WRITE_TOKEN`. Create a Blob store under the Vercel project's Storage tab.


---

# Workstream E: POS drop-in bookings, Stripe Tax, clay & firing, gift card codes

## Built

**Drop-ins book a real session**
- `GET /api/pos/catalog` now returns `upcomingSessions`: sessions at the order's location from today (Mountain Time) through the next 6 days, with seats left.
- The Drop-ins tab (`src/app/admin/pos/_components/CatalogPanel.tsx`) shows a day picker (default: today) and the session list. Full sessions, and sessions already in the cart, are disabled.
- `POST /api/pos/orders/[id]/items` with `DROP_IN` requires `metadata.studioSessionId`, and checks the session:
  - it's at the order's location (400 `WRONG_LOCATION`)
  - it isn't cancelled (409 `SESSION_CANCELLED`)
  - it isn't already in the order (409 `ALREADY_IN_ORDER`)
  - it has a seat (409 `SESSION_FULL`)
  - the customer, if attached, isn't already booked (409 `ALREADY_BOOKED`)
- The item keeps `refId` = sessionTypeId and stores `metadata.studioSessionId` (and `startsAt`). Quantity is fixed at 1.

**Payment gate**
- `checkOrderPayable()` in `src/lib/pos.ts` runs in every payment-start route: cash, card-manual, card-terminal, gift-card and comp.
- It returns 400 `{ error: "CUSTOMER_REQUIRED", message }` when the order has a drop-in line and no customer. Before the first payment it also returns 409 `SESSION_FULL` / `ALREADY_BOOKED` / `SESSION_CANCELLED`.
- The terminal UI (CartPanel and PaymentSheet) blocks Charge with a clear message when a customer is required.

**Completion (`maybeCompletePosOrder`)**
- Each DROP_IN line creates a Booking: CONFIRMED, source DROP_IN, `amountPaidCents` = line total, `posOrderItemId` = line id. The unique column makes it idempotent.
- It then fires `booking/confirmed` through `sendInngestEvent`, so the existing confirmation SMS and 24h reminder apply.
- If the session filled up between the payment check and completion, the booking is WAITLIST and a note is added to the order (shown on the success screen). Completion never fails after money is taken.

**Memberships tab removed** from CatalogPanel. Server-side MEMBERSHIP handling is unchanged.

**Stripe Tax**
- `src/lib/stripeTax.ts` wraps `stripe.tax.calculations.create`:
  - It sends the location's structured address as the customer address, with `address_source: "shipping"`.
  - It sends one line per taxable item, `tax_behavior: "exclusive"`. Tips are never sent.
  - It uses `expand: ["line_items"]` to store tax per item.
- `repriceOrder()` in `src/lib/pos.ts` runs after every item add, change or delete. It stores `PosOrderItem.taxCents`, `PosOrder.stripeTaxCalculationId`, and the total tax in `PosOrder.taxCents`.
- `calculateOrderTotals` stays pure: tax is passed in.
- On completion, `stripe.tax.transactions.createFromCalculation` runs with reference `pos-order-<orderNumber>` and an idempotency key.
- **Fallback:** zero tax plus a `taxWarning` in the item-change response, which the terminal shows as an amber banner. This covers four cases: `Location.taxEnabled` is false, the address is incomplete, Stripe Tax is inactive, or any Stripe error. Checkout is never blocked.
- `src/config/taxCodes.ts`:
  - RETAIL and CUSTOM (including clay and firing): `txcd_99999999`.
  - GIFT_CARD, DROP_IN and MEMBERSHIP: null (nontaxable).
  - All marked as placeholders pending JP.
- The cart shows a Tax line when tax is above 0.

**Clay & firing tab**
- New tab (`src/app/admin/pos/_components/FiringPanel.tsx`), backed by `src/config/firingPrices.ts`, whose price table and quote function are both flagged for JP.
- **Tiers:**
  - member under 12 in ($1.00/lb)
  - member over 12 in ($1.75/lb)
  - experience, flat per piece: ≤1 lb $9.99, ≤1.5 lb $12.99, ≤2 lb $14.99, over 2 lb refused with instructions
  - course: $0 up to 15 lb; over is refused
  - recycled clay: $0.50/lb in 1, 5, 10, 15 and 25 lb bags
- Adds a CUSTOM line with `metadata { kind: "FIRING", tier, weightOz, count, pieceIds? }`.
- The server recomputes the price from the metadata; it never trusts the client price.
- If the order has a customer, the tab lists their INTAKE pieces from `GET /api/admin/pieces?userId=…&status=INTAKE`. On completion, the selected pieces get `weightOz`, `chargedCents` and `posOrderItemId`.
- Quantity is locked on firing lines, as it is on drop-ins.
- The Custom tab's placeholder is now "Item name" instead of "Firing fee".

**Gift card codes**
- On completion, the codes generated for each GIFT_CARD line are stored on the line as `metadata.giftCardCodes`.
- Every completion response includes the order's items, so the codes come back in `order.items[].metadata.giftCardCodes`.
- The terminal success view shows them large and monospaced.

**`checkPermission` gets the location** (third argument) in every POS route that has one:
- Order-scoped routes check it once the order is loaded.
- Catalog, readers, drawer open/current/close/history and orders POST use the query or body `locationId`.
- Orders GET also scopes STAFF to their assigned locations via `resolveLocationScope`.

**Other**
- Voiding a COMPLETED order now cancels the drop-in bookings it created and fires `booking/cancelled`.
- The order PATCH refuses to change the customer (409 `CUSTOMER_LOCKED`) once a drop-in order has a payment.
- Every POS order response now includes `customer`. Previously, item and tip responses dropped it, so the cart lost the attached customer's name until reload.
- `scripts/terminal-e2e.ts` now also covers:
  - CUSTOMER_REQUIRED is refused
  - a DROP_IN line produces the expected Booking
  - re-settling creates no second booking
- The script creates and removes its own customer, session type and session, and prints the database it's connected to.

## Verified

- `npm run terminal:e2e` against the local `throw_launch_dev` database (Stripe test mode, simulated WisePOS E): **ALL CHECKS PASSED**. That covers the payment, tip reconciliation, completion, and a drop-in Booking with the right status, source, customer, session and amount. It also confirmed idempotent re-settle and that the missing-customer block works. Tax fell back to $0 with the warning (see below).
- `quoteFiring` spot-checked across every tier, including the refused cases (over 2 lb, over 15 lb, a clay bag that doesn't exist).
- `npx tsc --noEmit`: no errors in E files. `npx eslint` on E files: clean.

## Could not verify

- **A real Stripe Tax calculation.** Stripe Tax is **not active on the Stripe account, even in test mode**. A direct call returns `stripe_tax_inactive`. The request parameters match the SDK types, but no calculation, per-line tax, or `createFromCalculation` has run against Stripe. Once Tax is activated (with a Utah registration), re-run `npm run terminal:e2e`: the order line prints the tax amount, and the warning should disappear.
- **The terminal UI.** No dev server was run (not allowed in this phase), so the Drop-ins day picker, the Clay & firing tab, the tax banner and the gift card code display are type-checked but not clicked through.
- **The piece picker in the Clay & firing tab.** It depends on Workstream D's `GET /api/admin/pieces?userId=` (and `&status=INTAKE`). It accepts either a bare array or `{ pieces: [...] }` and filters to INTAKE on the client. Untested against D's real route.
- **Writing firing charges to Piece rows at completion.** The code path wasn't exercised; the e2e has no piece.

## Judgment calls

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

## Cross-workstream edits needed

**1. `src/inngest/functions.ts` (Workstream G / integration): put gift card codes and tax on the POS receipt.**

In `sendPosReceipt`, add to the imports:

```ts
import { formatMoney, metadataObject } from "@/lib/pos";
```

(replacing the existing `import { formatMoney } from "@/lib/pos";`).

Replace the `lines` construction with:

```ts
        const lines = order.items
          .map((i) => {
            const line = `  ${i.quantity}x ${i.name} — ${formatMoney(i.totalCents)}`;
            const raw = metadataObject(i.metadata).giftCardCodes;
            const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
            return codes.length > 0
              ? `${line}\n    Gift card code${codes.length > 1 ? "s" : ""}: ${codes.join(", ")}`
              : line;
          })
          .join("\n");
```

and add a tax line after the discount line in `body`:

```ts
          order.taxCents > 0 ? `Tax: ${formatMoney(order.taxCents)}` : null,
```

For the SMS fallback (customer has no email), append the codes so a phone-only buyer still gets them:

```ts
      const giftCardCodes = order.items.flatMap((i) => {
        const raw = metadataObject(i.metadata).giftCardCodes;
        return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
      });
      await sendSms({
        to: order.customer.phone!,
        message:
          `Throw Art Studio receipt #${order.orderNumber}. Total ${formatMoney(order.totalCents)}.` +
          (giftCardCodes.length > 0 ? ` Gift card code${giftCardCodes.length > 1 ? "s" : ""}: ${giftCardCodes.join(", ")}.` : "") +
          " Thanks!",
        userId: order.customer.id,
        kind: "transactional",
      });
```

**2. For Workstream D (information only, no edit needed).** POS drop-in bookings fire `booking/confirmed` at completion, exactly like online drop-ins, so any session-end piece prompt keyed off `booking/confirmed` covers them.

**3. For Workstream D (API contract).** The Clay & firing tab calls `GET /api/admin/pieces?userId=<id>&status=INTAKE` and reads `id`, `description`, `pieceCount`, `groupName`, `createdAt` and `status` from either `[...]` or `{ pieces: [...] }`.


---

# Workstream F: member access (set-password and reset)

Ships Sept 25. None of it is linked from anywhere except the new "Forgot password?" link on /login, so the branch behaves the same for Sept 18 whether or not F is in it. Without `RESEND_API_KEY`, requests succeed but no email goes out.

## Built

**Shared library.** `src/lib/email/passwordSetup.ts` holds the token helpers, the email copy and the send.
- Tokens reuse `VerificationToken`:
  - identifier `password-setup:<lowercased email>`
  - `token` holds a SHA-256 hex hash of 32 random bytes (base64url); the raw token only exists in the emailed link
  - `expires` is 24h after issue
- Issuing a token deletes earlier ones for that email. Using a token deletes it inside the same transaction that writes the password, so each link works once.
- Copy: "Set up your account" when `hashedPassword` is null (Momence imports), "Reset your password" otherwise. HTML and text versions.
- Sender: `RESEND_FROM_EMAIL ?? "Throw Art Studio <hello@throwartstudio.com>"`. Link: `${NEXT_PUBLIC_APP_URL}/set-password?token=…`.
- `issuePasswordEmail` deletes the token again if the email doesn't go out, so nobody is left holding a link they never received.

**Routes.**
- `POST /api/auth/request-reset { email }` is public and always returns 200 with the same body, whether or not the email exists or the send worked. The user lookup and send run in `after()` (next/server), so response timing doesn't reveal whether an account exists. It applies a 60-second cooldown per address (see Judgment calls).
- `POST /api/auth/set-password { token, password }` is public.
  - Minimum 8 characters (same as /api/auth/register), maximum 200.
  - bcrypt cost 12 (same as register).
  - Sets `emailVerified` if it was null.
  - Errors are 400 with `INVALID_TOKEN`, `TOKEN_EXPIRED` or `WEAK_PASSWORD`, each with a readable `message`.

**Pages** (all in the (auth) group, MUI card like /login):
- `/forgot-password` asks for an email and shows a neutral confirmation.
- `/set-password?token=` is a server page that validates the token and renders `_components/SetPasswordForm.tsx` (password + confirm). Expired and invalid links each get their own message and a "Get a new link" button.
- `/login` gets a "Forgot password?" link (the only change to that file).

**Invite script.** `scripts/send-password-setup.ts` emails every CUSTOMER with null `hashedPassword`.
- Flags:
  - `--dry-run` prints counts and the first 10 emails.
  - `--limit N`
  - `--location <id>` selects customers with a Booking at that location's sessions, or a Membership whose `locationId` or plan location matches.
  - `--force` re-sends to people who already hold a live link.
- Sends at most 10 per second.
- Skips anyone holding an unexpired link unless `--force`, so re-running resumes where it left off.
- Prints the database name and host first.
- Refuses to run for real without `RESEND_API_KEY`.
- **Not run for real.**

**Middleware.** `src/middleware.ts` only guards /admin, /staff, /dashboard, /account and /book*, so signed-out users can reach /forgot-password and /set-password. No change needed.

## Verified (local DB `throw_launch_dev` only)

- **Token and route test** (scratch script, calls the lib and the set-password route handler directly): all passed.
  - Issue, replace, stored-hashed and lowercased identifier.
  - Resolve: valid / setup mode.
  - Weak password rejected with the token kept.
  - Success sets the hash and `emailVerified` and consumes the token.
  - Reuse rejected.
  - Mode flips to "reset" once a password exists.
  - Expired tokens are reported as expired and deleted.
  - Garbage token rejected.
  - Email copy differs by mode and HTML-escapes the name.
  - With no Resend key the send returns `sent: false` and leaves no token behind.
- **Invite script dry-runs:** against the seed data (0 candidates), then with temporary users: all / `--force --limit 2` / `--location` / live-token skip / unknown argument rejected / real run refused without `RESEND_API_KEY`. Temporary rows were deleted afterwards.
- **`npx tsc --noEmit`:** no errors in F's files.

## Could not verify

- **Real email delivery.** No `RESEND_API_KEY`. Resend acceptance of `hello@throwartstudio.com`, rendering in mail clients, and spam placement are all untested.
- **`POST /api/auth/request-reset` end to end.** `after()` needs a Next request scope, which the scratch test doesn't have. Its lookup, cooldown and issue logic are the tested library functions, but the route wiring itself has only been type-checked.
- **The pages in a browser.** I didn't run `next dev`, per the rules.

## Judgment calls

- **Abuse protection** is at most one email per address per 60 seconds, measured from the current token's issue time (`VerificationToken` has no createdAt, so issue time = expires − 24h). There's no IP rate limit (no infrastructure for it).
- **Only the latest link works.** A new request replaces the previous link. Someone who clicks an older email gets "This link isn't valid" and can request another.
- **Set-password heading** ("Set up your account" vs "Reset your password") is decided server-side when the /set-password page loads, from the token. There's no public endpoint that could reveal whether an email has an account.
- **After setting a password** the page shows a success state with a "Sign in" button to /login. It doesn't sign them in automatically (the simplest option, and easy to change).
- **Existing sessions aren't revoked on reset.** NextAuth uses JWT sessions and there's no revocation list, so other devices stay signed in until their JWTs expire.
- **Email matching is case-insensitive** (`mode: "insensitive"`), because register doesn't lowercase emails.
- **The invite script refuses to run for real without `RESEND_API_KEY`,** rather than creating links nobody receives. `--location` uses the Phase 0 customer-to-location rule; memberships whose location and plan location are both null don't count.

## Cross-workstream edits needed

**`package.json`** (owner: G). Add to `"scripts"`. It follows the `terminal:e2e` style because the script imports `@/lib/*` and needs tsconfig-paths:

```json
"members:invite": "TS_NODE_PROJECT=tsconfig.scripts.json node --env-file=.env --require ts-node/register --require tsconfig-paths/register scripts/send-password-setup.ts"
```

Usage: `npm run members:invite -- --dry-run` (also `--limit N`, `--location <id>`, `--force`).

## Manual steps for Sam

- **Env vars in Vercel and `.env`:** set `RESEND_API_KEY`. Optionally set `RESEND_FROM_EMAIL` (defaults to `Throw Art Studio <hello@throwartstudio.com>`). `NEXT_PUBLIC_APP_URL` must be the production URL, or the emailed links will point at localhost.
- **Before inviting everyone:**
  1. Run `npm run members:invite -- --dry-run`.
  2. Then run a small batch (`--limit 5` to addresses you control, if possible).
  3. Then the full run: about 7,989 customers, around 15 minutes at 10 per second. Check Resend's plan limits for daily sends first.


---

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
