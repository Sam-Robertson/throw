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
