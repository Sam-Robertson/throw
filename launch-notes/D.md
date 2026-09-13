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
