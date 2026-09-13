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
