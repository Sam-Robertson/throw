# Codebase Audit — Throw (pottery studio booking & membership platform)

Generated: 2026-07-22. Read-only audit — no code was modified.

---

## 1. Page routes under `src/app`

Route groups `(auth)`, `(customer)`, `(public)`, `(staff)` don't affect the URL. `admin/*` and root-level files are not in a group.

### Layouts

| File | Provides |
|---|---|
| `src/app/layout.tsx` | Root HTML shell — fonts, MUI theme provider, global UTM-capture tracking component. No auth/nav. |
| `src/app/(auth)/layout.tsx` | Wraps login/register with `PublicNav` (session-aware), bare `<main>`, no footer. |
| `src/app/(customer)/layout.tsx` | `PublicNav` + `PublicFooter`, session-aware. |
| `src/app/(public)/layout.tsx` | Same as customer layout — `PublicNav` + `<main>` + `PublicFooter`. |
| `src/app/admin/layout.tsx` | Auth guard (`redirect("/login")` if no session) + `AdminNav` sidebar + `InboxCountProvider` context. |

Note: no `(staff)/layout.tsx` exists — the one staff page relies only on the root layout.

Note: `src/app/schedule` is an **empty directory** (no files) — stray/orphaned folder, likely leftover from a refactor (the real schedule pages live under `(public)/schedule`).

### `(auth)`

| Route | File | Description | Lines | Stub? |
|---|---|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Client credentials login form via NextAuth `signIn`. | 110 | No |
| `/register` | `(auth)/register/page.tsx` | Client registration form → `/api/auth/register` → auto sign-in. | 148 | No |

### `(customer)`

| Route | File | Description | Lines | Stub? |
|---|---|---|---|---|
| `/account` | `(customer)/account/page.tsx` | Fetches current user, renders Profile/Password/DangerZone forms. | 74 | No |
| `/book/[id]` | `(customer)/book/[id]/page.tsx` | Booking flow for a session — checks auth/waiver/existing booking/membership, renders `BookingForm`. | 159 | No |
| `/booking/success` | `(customer)/booking/success/page.tsx` | Post-checkout confirmation — looks up booking by Stripe payment intent. | 169 | No |
| `/bookings/[id]/tip` | `(customer)/bookings/[id]/tip/page.tsx` | Tip-the-instructor flow for a completed booking. | 112 | No |
| `/bookings` | `(customer)/bookings/page.tsx` | Client list of user's bookings (upcoming/past/cancelled) with cancel/tip actions. | 253 | No |
| `/dashboard` | `(customer)/dashboard/page.tsx` | Customer dashboard — membership, waiver status, upcoming bookings, quick links. | 240 | No |
| `/membership/manage` | `(customer)/membership/manage/page.tsx` | Current membership status/billing/events + plan switcher. | 120 | No |
| `/membership/subscribe/[planId]` | `(customer)/membership/subscribe/[planId]/page.tsx` | Plan detail + Stripe checkout button. | 63 | No |
| `/membership/success` | `(customer)/membership/success/page.tsx` | Post-checkout membership confirmation. | 50 | No |
| `/waiver` | `(customer)/waiver/page.tsx` | Loads active waiver version, renders sign form (skips if already signed). | 53 | No |

### `(public)`

| Route | File | Description | Lines | Stub? |
|---|---|---|---|---|
| `/` | `(public)/page.tsx` | Marketing homepage — hero, "this week" sessions, plans teaser, hours/location. | 279 | No |
| `/about` | `(public)/about/page.tsx` | Static marketing page — no data fetching at all (fully hardcoded copy). | 138 | Not a stub by size, but **fully static/no data** — flagged for note |
| `/community` | `(public)/community/page.tsx` | Community feed — published posts (or all, for staff/admin) + like status. | 87 | No |
| `/community/[id]` | `(public)/community/[id]/page.tsx` | Single post + comments, enforces published/staff visibility. | 95 | No |
| `/lp/[slug]` | `(public)/lp/[slug]/page.tsx` | Renders a `LandingPage` record (hero, headline, HTML body, CTA). | 62 | No |
| `/membership` | `(public)/membership/page.tsx` | Public plans list with Join/Manage CTA depending on auth state. | 130 | No |
| `/schedule` | `(public)/schedule/page.tsx` | Public schedule browser — filter pills, sessions grouped by date. | 193 | No |
| `/schedule/[id]` | `(public)/schedule/[id]/page.tsx` | Single session detail with context-aware CTA. | 167 | No |

### `(staff)`

| Route | File | Description | Lines | Stub? |
|---|---|---|---|---|
| `/staff` | `(staff)/staff/page.tsx` | Only checks session and prints the logged-in user's name/role. | 16 | **YES — stub.** No data fetching, no staff-specific feature content whatsoever. |

### `admin` (ungrouped, `/admin/...`)

| Route | File | Description | Lines | Stub? |
|---|---|---|---|---|
| `/admin` | `admin/page.tsx` | Dashboard — revenue/trend cards, today's schedule, quick actions, tasks, activity feed. | 869 | No |
| `/admin/automations` | `admin/automations/page.tsx` | CRUD table for SMS automation rules. | 375 | No |
| `/admin/class-types` | `admin/class-types/page.tsx` | CRUD table for session/class types. | 379 | No |
| `/admin/community` | `admin/community/page.tsx` | Post table with publish/unpublish/edit/delete. | 155 | No |
| `/admin/community/new` | `admin/community/new/page.tsx` | Thin wrapper rendering `PostForm` in create mode. | 14 | **Borderline stub by line count**, but delegates to a real functional form component — not a placeholder. |
| `/admin/community/[id]/edit` | `admin/community/[id]/edit/page.tsx` | Loads one post, renders `PostForm` in edit mode. | 44 | No |
| `/admin/customers` | `admin/customers/page.tsx` | Searchable/paginated customer table. | 190 | No |
| `/admin/customers/[id]` | `admin/customers/[id]/page.tsx` | Full customer profile — bookings/membership/waivers/tasks tabs. | 697 | No |
| `/admin/inbox` | `admin/inbox/page.tsx` | Two-pane SMS/email inbox. | 584 | No |
| `/admin/landing-pages` | `admin/landing-pages/page.tsx` | Landing page table with preview/edit/activate toggle. | 123 | No |
| `/admin/landing-pages/new` | `admin/landing-pages/new/page.tsx` | Create form → redirects to edit page. | 45 | No |
| `/admin/landing-pages/[id]/edit` | `admin/landing-pages/[id]/edit/page.tsx` | Edit form + delete + live preview link. | 153 | No |
| `/admin/membership-plans` | `admin/membership-plans/page.tsx` | CRUD table for membership plans. | 305 | No |
| `/admin/memberships` | `admin/memberships/page.tsx` | Active memberships table with event history, pause/cancel/resume. | 234 | No |
| `/admin/reports` | `admin/reports/page.tsx` | Tabbed analytics — Overview/Revenue/Memberships/Attendance/Ad Tracking. | 178 | No |
| `/admin/schedule` | `admin/schedule/page.tsx` | Weekly calendar with create/edit/cancel session dialogs. | 480 | No |
| `/admin/studio-setup/discount-codes` | `admin/studio-setup/discount-codes/page.tsx` | CRUD table for discount codes — **operates on Stripe promotion codes, not the Prisma `DiscountCode` model** (see §3). | 584 | No |
| `/admin/studio-setup/gift-cards` | `admin/studio-setup/gift-cards/page.tsx` | Gift card table with balance progress bar, create dialog. | 272 | No |
| `/admin/studio-setup/instructors` | `admin/studio-setup/instructors/page.tsx` | Instructor roster — sets `User.role` via `/api/admin/users/[id]/role`. Does **not** manage `StaffRole`/`StaffRoleAssignment` permission records despite the schema supporting granular permissions. | 508 | No |
| `/admin/studio-setup/locations` | `admin/studio-setup/locations/page.tsx` | CRUD table for studio locations. | 260 | No |
| `/admin/studio-setup/pay-rates` | `admin/studio-setup/pay-rates/page.tsx` | Pay rate table with create/edit dialogs. | 288 | No |
| `/admin/studio-setup/products` | `admin/studio-setup/products/page.tsx` | Retail product catalog CRUD. | 598 | No |
| `/admin/studio-setup/templates` | `admin/studio-setup/templates/page.tsx` | Email/SMS template editor with variable insertion, preview, test-send. Largest page in the app. | 1114 | No |
| `/admin/tasks` | `admin/tasks/page.tsx` | Staff task board with filters, assignment, detail drawer. | 735 | No |
| `/admin/waivers` | `admin/waivers/page.tsx` | Waiver version management + per-version signature list. | 392 | No |

**Stub summary:**
- `src/app/(staff)/staff/page.tsx` (16 lines) — genuine stub, no real content.
- `src/app/admin/community/new/page.tsx` (14 lines) — under the 20-line threshold but delegates to a working shared form; not a dead end.
- `src/app/(public)/about/page.tsx` — not a line-count stub, but 100% static content with zero data fetching; contains "coming soon" placeholder copy (private events, photos).

---

## 2. API routes under `src/app/api`

76 `route.ts` files.

### account
- **`/api/account`** — DELETE: delete own account, cancels active/paused Stripe subscription first. *(any authenticated user)*
- **`/api/account/password`** — PATCH: change password, verifies current via bcrypt. *(authenticated)*
- **`/api/account/profile`** — PATCH: update name/phone/emergency contact. *(authenticated)*

### admin/automations
- **`/api/admin/automations`** — GET: list; POST: create (validates trigger event). *(ADMIN/STAFF)*
- **`/api/admin/automations/[id]`** — PATCH: update; DELETE: remove. *(ADMIN/STAFF)*
- **`/api/admin/automations/[id]/test`** — POST: send test SMS via Twilio. *(ADMIN/STAFF)*
- **`/api/admin/automations/[id]/toggle`** — PATCH: toggle `isActive`. *(ADMIN/STAFF)*

### admin/bookings
- **`/api/admin/bookings/[id]`** — PATCH: transition booking status via allow-listed state machine. *(ADMIN/STAFF)*

### admin/customers
- **`/api/admin/customers`** — GET: search/paginated list with membership+booking summary. *(ADMIN/STAFF)*
- **`/api/admin/customers/[id]`** — GET: full profile (memberships/bookings/waivers/tasks); PATCH: update profile fields. *(ADMIN/STAFF)*

### admin/dashboard
- **`/api/admin/dashboard`** — GET: aggregated revenue/members/bookings/tasks/activity/MRR/sparkline. *(ADMIN/STAFF)*

### admin/discount-codes
- **`/api/admin/discount-codes`** — GET: list Stripe promotion codes *(ADMIN/STAFF)*; POST: create Stripe coupon+promo code *(ADMIN)*.
- **`/api/admin/discount-codes/[id]`** — PATCH: activate/deactivate promo code. *(ADMIN)*

### admin/gift-cards
- **`/api/admin/gift-cards`** — GET: list *(ADMIN/STAFF)*; POST: create, checks duplicate code *(ADMIN)*.
- **`/api/admin/gift-cards/[id]`** — PATCH: update balance/expiry/active; DELETE: remove. *(ADMIN)*

### admin/inbox
- **`/api/admin/inbox`** — GET: list conversations by segment/search; POST: create conversation + initial message. *(ADMIN/STAFF)*
- **`/api/admin/inbox/[id]`** — GET: conversation + messages; PATCH: mark read. *(ADMIN/STAFF)*
- **`/api/admin/inbox/[id]/messages`** — POST: send reply (SMS via Twilio or email via Resend). *(ADMIN/STAFF)*
- **`/api/admin/inbox/unread-count`** — GET: total unread count. *(ADMIN/STAFF)*

### admin/landing-pages
- **`/api/admin/landing-pages`** — GET: list *(ADMIN/STAFF)*; POST: create, validates slug uniqueness *(ADMIN/STAFF)*.
- **`/api/admin/landing-pages/[id]`** — GET/PATCH *(ADMIN/STAFF)*; DELETE *(ADMIN only)*.
- **`/api/admin/landing-pages/[id]/toggle`** — PATCH: toggle `isActive`. *(ADMIN/STAFF)*

### admin/locations
- **`/api/admin/locations`** — GET: list with session/membership counts *(ADMIN/STAFF)*; POST: create *(ADMIN)*.
- **`/api/admin/locations/[id]`** — PATCH: update. *(ADMIN)*

### admin/membership-plans
- **`/api/admin/membership-plans`** — GET: list with active-member counts; POST: create. *(ADMIN/STAFF)*
- **`/api/admin/membership-plans/[id]`** — PATCH: update, blocks price change if plan has active members. *(ADMIN/STAFF)*
- **`/api/admin/membership-plans/[id]/toggle`** — PATCH: toggle `isActive`. *(ADMIN/STAFF)*

### admin/memberships
- **`/api/admin/memberships`** — GET: list all with user/plan info. *(ADMIN/STAFF)*
- **`/api/admin/memberships/[id]/cancel`** — PATCH: cancel Stripe sub + mark CANCELLED + log event. *(ADMIN)*
- **`/api/admin/memberships/[id]/pause`** — PATCH: cancel-at-period-end + 30-day resume + log event. *(ADMIN)*
- **`/api/admin/memberships/[id]/events`** — GET: event history. *(ADMIN/STAFF)*

### admin/pay-rates
- **`/api/admin/pay-rates`** — GET: list *(ADMIN/STAFF)*; POST: create *(ADMIN)*.
- **`/api/admin/pay-rates/[id]`** — PATCH/DELETE. *(ADMIN)*

### admin/products
- **`/api/admin/products`** — GET: list *(ADMIN/STAFF)*; POST: create *(ADMIN)*.
- **`/api/admin/products/[id]`** — PATCH/DELETE. *(ADMIN)*

### admin/reports
- **`/api/admin/reports/ad-tracking`** — GET: UTM source/medium/campaign breakdown + conversion rates. *(ADMIN only)*
- **`/api/admin/reports/attendance`** — GET: attendance stats + day/hour heatmap. *(ADMIN/STAFF)*
- **`/api/admin/reports/memberships`** — GET: membership summary/MRR/by-plan breakdown/event log. *(ADMIN/STAFF, but STAFF additionally requires `canViewMembershipReporting` permission via `StaffRoleAssignment`)*
- **`/api/admin/reports/overview`** — GET: revenue overview, new/active members, bookings, cancellations. *(ADMIN only)*
- **`/api/admin/reports/revenue`** — GET: paginated payments + refunds + totals. *(ADMIN only)*

### admin/session-types
- **`/api/admin/session-types`** — GET: list with upcoming session counts; POST: create (auto-slugify). *(ADMIN/STAFF)*
- **`/api/admin/session-types/[id]`** — GET/PATCH (re-slugify on rename)/DELETE (blocked if future sessions reference it). *(ADMIN/STAFF)*

### admin/sms-log
- **`/api/admin/sms-log`** — GET: last 100 SMS log entries, optional userId filter. *(ADMIN/STAFF)*

### admin/staff
- **`/api/admin/staff`** — GET: list ADMIN/STAFF users (id/name/email). *(ADMIN/STAFF)*

### admin/studio-sessions
- **`/api/admin/studio-sessions`** — GET: list sessions in date range (default current week MT); POST: create, checks duplicate slot. *(ADMIN/STAFF)*
- **`/api/admin/studio-sessions/[id]`** — PATCH: update/cancel (auto-cancels CONFIRMED bookings); DELETE: blocked if bookings exist. *(ADMIN/STAFF)*

### admin/tasks
- **`/api/admin/tasks`** — GET: filterable/paginated list; POST: create manual task. *(ADMIN/STAFF)*
- **`/api/admin/tasks/[id]`** — PATCH: STAFF limited to status/assignee, ADMIN can edit all fields; DELETE. *(ADMIN/STAFF, DELETE is ADMIN only)*

### admin/templates
- **`/api/admin/templates`** — GET: list *(ADMIN/STAFF)*; POST: create *(ADMIN)*.
- **`/api/admin/templates/[id]`** — PATCH/DELETE. *(ADMIN)*
- **`/api/admin/templates/[id]/test`** — POST: send test SMS/email with sample variables. *(ADMIN)*
- **`/api/admin/templates/seed-defaults`** — POST: bulk-seed hardcoded default templates, skips existing. *(ADMIN)*

### admin/users
- **`/api/admin/users`** — GET: list ADMIN/STAFF users with latest active pay rate. *(ADMIN/STAFF)*
- **`/api/admin/users/[id]/role`** — PATCH: change role, blocks self-demotion from ADMIN. *(ADMIN)*

### admin/waivers
- **`/api/admin/waivers`** — GET: list versions with signature counts *(ADMIN/STAFF)*; POST: publish new version, deactivates prior in a transaction *(ADMIN)*.
- **`/api/admin/waivers/[id]/signatures`** — GET: paginated signature list. *(ADMIN/STAFF)*

### auth
- **`/api/auth/[...nextauth]`** — GET/POST: NextAuth handlers (login/session/callbacks). *(public — framework-managed)*
- **`/api/auth/register`** — POST: create customer account, hashes password, links ad-tracking. *(public)*

### bookings
- **`/api/bookings`** — GET: own bookings by status; POST: create booking using membership credit, auto-waitlists if full, fires Inngest event. *(authenticated, requires ACTIVE membership for POST)*
- **`/api/bookings/[id]`** — GET: single booking, owner or ADMIN/STAFF only.
- **`/api/bookings/[id]/cancel`** — POST: cancel own booking, blocked within 2 hours of start.
- **`/api/bookings/checkout`** — POST: Stripe Checkout session for drop-in payment. *(authenticated)*

### community
- **`/api/community/posts`** — GET: paginated posts, published-only for non-staff *(public read)*; POST: create *(ADMIN/STAFF)*.
- **`/api/community/posts/[id]`** — GET: single post *(public, role-gated visibility)*; PATCH/DELETE *(ADMIN/STAFF)*.
- **`/api/community/posts/[id]/comments`** — GET: list *(public)*; POST: add comment *(authenticated)*.
- **`/api/community/posts/[id]/like`** — POST: toggle like. *(authenticated)*
- **`/api/community/comments/[id]`** — DELETE: comment author or ADMIN.

### inngest
- **`/api/inngest`** — GET/POST/PUT: Inngest `serve()` handler (booking/membership email + reminder functions). Auth delegated entirely to the Inngest SDK.

### memberships
- **`/api/memberships/subscribe`** — POST: create Stripe customer + checkout subscription, blocks if already ACTIVE. *(authenticated)*
- **`/api/memberships/cancel`** — POST: cancel own membership's Stripe subscription.
- **`/api/memberships/pause`** — POST: pause own membership (cancel-at-period-end + 30-day resume), fires Inngest event.
- **`/api/memberships/resume`** — POST: resume PAUSED membership via new subscription.
- **`/api/memberships/change-plan`** — POST: switch plans via subscription item update w/ proration, logs UPGRADED/DOWNGRADED.

### tips
- **`/api/tips`** — POST: Stripe Checkout for instructor tip, validates $1–$100, session ended, blocks duplicate tip per booking. *(authenticated, ownership enforced)*

### tracking
- **`/api/tracking/utm`** — POST: create/update `AdTracking` by session token from UTM params. *(public/anonymous)*
- **`/api/tracking/identify`** — POST: link anonymous tracking record to a userId. *(public)*
- **`/api/tracking/convert`** — POST: record first-booking/first-purchase timestamps. *(public)*

### waivers
- **`/api/waivers/sign`** — POST: record signature (IP, typed name, signature image), blocks duplicate. *(authenticated)*
- **`/api/waivers/status`** — GET: has current user signed the active version? *(authenticated)*

### webhooks
- **`/api/webhooks/stripe`** — POST: Stripe webhook (signature-verified via `STRIPE_WEBHOOK_SECRET`), handles subscription lifecycle, invoice payment success/failure, and checkout completion (branches tip vs. drop-in booking payment). No app-level session auth — trust boundary is Stripe signature verification. Uses `force-dynamic` + raw body.

### Observations on auth/permission consistency (informational, not fixed)
- Most admin resources follow a "view broad (ADMIN/STAFF), mutate narrow (ADMIN)" pattern (gift cards, products, pay rates, templates, discount codes), but it isn't universal — e.g. automations, landing pages, and session-types allow STAFF to POST/PATCH.
- `admin/reports/memberships` is the only report with a granular permission check (`canViewMembershipReporting` via `StaffRoleAssignment`); the other four report endpoints use a flat ADMIN or ADMIN/STAFF check — but see §3, this permission system has no admin UI to configure it.
- `DELETE /api/account` lets any authenticated user (including an ADMIN) delete their own account, with no equivalent self-protection to the self-demotion guard on `/api/admin/users/[id]/role`.
- No rate-limiting visible on public-write endpoints (`community/posts/[id]/comments` POST, `tracking/*`).

---

## 3. Prisma models — `prisma/schema.prisma` (31 models)

| Model | Admin UI | Customer/Public UI | Notes |
|---|---|---|---|
| `Account` | — | — | NextAuth internal (OAuth account linking). No UI needed. |
| `Session` | — | — | NextAuth internal. No UI needed. |
| `VerificationToken` | — | — | NextAuth internal. No UI needed. |
| `User` | ✅ `/admin/customers*`, `/admin/studio-setup/instructors`, role mgmt API | ✅ `/account` | Fully covered. |
| `Location` | ✅ `/admin/studio-setup/locations` | — | Used internally (timezone, session/membership scoping); no customer-facing location picker UI. |
| `StaffRole` | ⚠️ **None** | — | Schema supports named roles + granular `permissions` JSON (checked in `admin/reports/memberships`), but there is **no admin UI to create/edit roles** — only created via `prisma/seed.ts`. |
| `StaffRoleAssignment` | ⚠️ **None** | — | Same gap — no UI to assign a role to a staff member; only seeded. The instructors page changes `User.role` (CUSTOMER/STAFF/ADMIN) but never touches this table. |
| `WaiverVersion` | ✅ `/admin/waivers` | ✅ `/waiver` | Fully covered. |
| `WaiverSignature` | ✅ `/admin/waivers` (signatures list) | ✅ `/waiver` (signing) | Fully covered. |
| `MembershipPlan` | ✅ `/admin/membership-plans` | ✅ `/membership`, `/membership/subscribe/[planId]` | Fully covered. |
| `Membership` | ✅ `/admin/memberships` | ✅ `/dashboard`, `/membership/manage` | Fully covered. |
| `MembershipEvent` | ✅ `/admin/memberships` (expandable event history) | ✅ `/membership/manage` (recent events list) | Fully covered. |
| `SessionType` | ✅ `/admin/class-types` | ✅ `/schedule` (filter pills) | Fully covered. |
| `StudioSession` | ✅ `/admin/schedule` | ✅ `/schedule`, `/schedule/[id]`, `/book/[id]` | Fully covered. |
| `Booking` | ✅ `/admin/customers/[id]`, dashboard, reports; status transitions via API | ✅ `/bookings`, `/book/[id]`, `/booking/success` | Fully covered. |
| `Payment` | ✅ `/admin/reports/revenue`, dashboard | — | No customer-facing receipt/payment-history view; customers only see booking/membership status, not raw payment records. |
| `Tip` | ⚠️ **None** | ✅ `/bookings/[id]/tip` | Tips are created customer-side and paid out via Stripe, but there is **no admin page or API to view/report on tips** (not even in reports). Instructors/admins can't see tip totals in-app. |
| `StaffTask` | ✅ `/admin/tasks` | — | Internal ops tool; no customer UI needed. |
| `SmsAutomation` | ✅ `/admin/automations` | — | Internal; no customer UI needed. |
| `AdTracking` | ✅ `/admin/reports/ad-tracking` | — (write-only via tracking API, no UI) | Written by anonymous tracking pixels/API, read only in admin reports. |
| `SmsLog` | ✅ surfaced inside `/admin/automations` and `/admin/studio-setup/templates` (fetched from `/api/admin/sms-log`) | — | No dedicated standalone page, but reachable from two admin pages. |
| `CommunityPost` | ✅ `/admin/community*` | ✅ `/community`, `/community/[id]` | Fully covered. |
| `CommunityLike` | — | ✅ like button on community pages | No admin visibility, but likes are low-stakes; probably fine. |
| `CommunityComment` | ⚠️ **Count only** | ✅ comments section on post detail | Admin community table shows a comment *count* per post but there is **no moderation UI** — admins can't view or delete a customer's comment from the admin panel (the delete API exists — author or ADMIN — but nothing in the admin UI calls it). |
| `LandingPage` | ✅ `/admin/landing-pages*` | ✅ `/lp/[slug]` | Fully covered. |
| `PayRate` | ✅ `/admin/studio-setup/pay-rates` | — | Internal; no customer UI needed. |
| `RetailProduct` | ✅ `/admin/studio-setup/products` | ⚠️ **None** | Products can be created/priced/stocked in admin, but there is **no public storefront or checkout flow** for customers to actually buy them. |
| `DiscountCode` | ⚠️ **Unused / orphaned model** | — | The admin discount-codes page and its API (`/api/admin/discount-codes*`) operate entirely on **Stripe's promotion-code API**, not this table. Grepping the whole codebase for `discountCode`/`DiscountCode` (case-sensitive Prisma accessor) turns up **zero references** outside `schema.prisma` itself. This model appears to be dead schema — either a leftover from before the Stripe-native approach was adopted, or a planned-but-unbuilt feature. |
| `GiftCard` | ✅ `/admin/studio-setup/gift-cards` | ⚠️ **None** | Admin can create/manage gift card balances, but there's no customer-facing way to purchase a gift card or redeem one at checkout. |
| `TransactionalTemplate` | ✅ `/admin/studio-setup/templates` | — | Internal; renders into emails/SMS, not a page. |
| `Conversation` | ✅ `/admin/inbox` | — | Customers receive the SMS/email but have no in-app thread view. |
| `ConversationMessage` | ✅ `/admin/inbox` | — | Same as above. |

**Summary:** 22 of 31 models have full/expected coverage. Notable gaps:
- **`DiscountCode` is entirely orphaned** — the admin UI that appears to manage it actually talks to Stripe directly.
- **`StaffRole` / `StaffRoleAssignment`** have a permission system with no admin UI — only seedable.
- **`Tip`** has no admin-side visibility at all despite being real revenue.
- **`RetailProduct`** and **`GiftCard`** are admin-manageable but have no customer purchase path.
- **`CommunityComment`** has no moderation UI beyond a count.

---

## 4. TODO / FIXME comments

**None found.** Searched all `.ts`/`.tsx`/`.js`/`.md` files (excluding `node_modules`, `.next`, `.git`) for `TODO` and `FIXME` — zero matches anywhere in `src/`, `prisma/`, or the repo root.

---

## 5. Broken imports / references to non-existent files

**None found.** Checked every `import`/`export ... from`/`require()` specifier in `src/` that used a relative (`./`, `../`) or path-alias (`@/*` → `src/*`) form, resolving against the filesystem (including implicit `index.ts(x)` and extension-less resolution). All resolved successfully.

Also checked:
- No `public/` directory exists in the project, and no hardcoded `/`-rooted asset paths (images, etc.) were found outside of internal Next.js route `href`s (which are routes, not files, and all point to real pages).
- `src/app/schedule/` is an empty directory — not a broken reference per se (nothing imports from it), but it's dead/stray and worth cleaning up or explaining.

---

## 6. `npm run build`

**Build succeeded.** No errors. Two warnings, both from a third-party dependency (not app code):

```
./node_modules/jose/dist/webapi/lib/deflate.js
A Node.js API is used (CompressionStream at line: 10) which is not supported in the Edge Runtime.

./node_modules/jose/dist/webapi/lib/deflate.js
A Node.js API is used (DecompressionStream at line: 26) which is not supported in the Edge Runtime.
```

Both originate from `jose` → `@auth/core` → `next-auth`'s JWT handling, pulled in via the middleware bundle (`src/middleware.ts`, 85.4 kB). This is a known upstream NextAuth/Edge-runtime warning, not a bug in this codebase — it only matters if the app ever relies on JWE-encrypted session cookies while running on the Edge runtime.

All 80 routes (pages + API) compiled and either statically or dynamically rendered without error. Type checking and linting passed as part of the build.

---

## Appendix: full model list (for reference)

`Account`, `Session`, `VerificationToken`, `User`, `Location`, `StaffRole`, `StaffRoleAssignment`, `WaiverVersion`, `WaiverSignature`, `MembershipPlan`, `Membership`, `MembershipEvent`, `SessionType`, `StudioSession`, `Booking`, `Payment`, `Tip`, `StaffTask`, `SmsAutomation`, `AdTracking`, `SmsLog`, `CommunityPost`, `CommunityLike`, `CommunityComment`, `LandingPage`, `PayRate`, `RetailProduct`, `DiscountCode`, `GiftCard`, `TransactionalTemplate`, `Conversation`, `ConversationMessage`.
