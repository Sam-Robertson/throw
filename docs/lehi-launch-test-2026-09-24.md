# Lehi launch test, 2026-09-24

Final check of the four Lehi flows before JP is told they are ready:
booking, in-person checkout, waivers, piece intake. Run against production
(`throw-kappa.vercel.app`, signed in as the admin account) and the production
database, read-only except where noted. Nothing was booked, signed, charged or
logged on production during the test.

## Result

| Flow | Verdict | Notes |
|---|---|---|
| Waivers | Ready | Booking a Lehi class as an account that has not signed shows "Before you book" with the Lehi waiver v2 (full liability text). Admin → Waivers shows Provo, Lehi, Course (courses only) and Membership waivers. |
| Piece intake | Ready | Admin → Pieces → Print QR poster renders the Lehi poster; its link opens `/pieces/new?location=<Lehi>` which, signed out, goes to login and back. Signed in, the form says "Logging pieces at Lehi". Photo uploads are off (see gaps). |
| Booking | Ready after the fix below | Schedule, session page and booking confirmation did not say which studio a class is at. Fixed in this commit: studio filter chips on the schedule, a Studio row on every card, studio and address on the session page, studio on the booking confirmation. Lehi prices show correctly ($35 Clay Together, $200 Kickstart, $257 After-School). |
| In-person checkout | Blocked by setup | POS switches to Lehi and lists Lehi classes at Lehi prices, but Lehi has no Stripe Terminal location, so the reader row says "Lehi has no card reader location yet". The reader named "Lehi Reader" is registered under Provo's Terminal location. Reader tip screen is already on. |

## Before telling JP: setup in the live admin

1. **Card reader at Lehi.** Admin → Studio setup → Card readers → Studio: Lehi →
   "Set up card readers here" (creates the Stripe Terminal location). Then
   re-pair the WisePOS E to Lehi so it stops appearing under Provo. Do a
   $1 Custom amount sale on the reader and refund it.
2. ~~Cancel two duplicate course sessions at Lehi.~~ Done 2026-09-24 by
   `scripts/cancel-lehi-duplicate-sessions-2026-09-24.ts`: the one-session
   copies of Pottery Kickstart (Oct 5) and After-School (Oct 7) are cancelled.
3. **One real booking.** From a customer account that has not signed the Lehi
   waiver (robertsonnew@gmail.com qualifies): book Clay Together Oct 1 at
   Lehi, sign the waiver, pay $35, check the confirmation email, then cancel
   or refund. This is the only step that exercises live Stripe Checkout.
4. **Lehi staff.** No staff roles exist at Lehi, so no one can be assigned
   there and Lehi sessions have no instructor. Admin → Studio setup → Roles:
   add Instructor and Front Desk at Lehi, then assign the Lehi staff. Admins
   are not affected.

## Gaps found, not blocking Lehi

- **Seed data is on production.** Inventory and a dry-run removal script in
  `scripts/remove-seed-data.ts` (see its header). Staff logins
  maya@, diego@, frontdesk@ and staff@throw.studio should go before launch.
  The daily 6:00 AM "Pay for Pottery Pieces" session is a Momence import of
  an inactive class type, not seed; it still appears on the admin dashboard.
- **Photo uploads** on the piece form are off because the upload service is
  not configured on Vercel. The old Google Form took photos.
- **Poster URL** is `throw-kappa.vercel.app`. If the site moves to
  `throwartstudio.com`, print the posters after the move.
- **Member firing** products are missing or unpriced (POS says so). Provo
  scope, Sept 25.
- The staff roster page does not name the studio either. Minor.
