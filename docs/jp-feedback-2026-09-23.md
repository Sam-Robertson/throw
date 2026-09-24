# JP's feedback of 2026-09-23: what changed

Three asks from JP's reply to the Loom videos, and what was built for each.
Everything below is verified against the local database (`throw_launch_dev`)
and, for the reader tip screen, against the Stripe **test** account.

## 1. Waivers: several, customisable, per studio or for every studio

Before: one text per studio, versioned. Now a **Waiver** is a document with a
name, a type and a studio (or "All studios"), and its own version history.

| Type | When it is required |
|---|---|
| Class waiver | Before booking online, before a POS drop-in sale, and shown on the staff roster. A studio's own class waiver plus any all-studio class waiver, all must be signed. |
| Membership waiver | Before starting a membership online (subscribe page and API). No fallback: with none published, memberships need no waiver, as today. |
| Other | Never automatically. Signed via its link or printed QR code (workshops, kids camps, photo releases). |

- Admin → Waivers: **New waiver**, **Publish new version**, **Rename**, **Archive** /
  **Restore**, **Sign link** (copy, or print a QR poster), per-version signature
  lists, and the "Has someone signed?" lookup now names the waiver.
- Existing versions and signatures are untouched: the migration groups them into
  one class waiver per studio ("Provo waiver", "Lehi waiver"). Rename them in
  admin if you like.
- Class-waiver fallback is unchanged: a studio with no class waiver of its own
  uses the newest one elsewhere, so Lehi is covered until it gets its own.
- `/waiver?waiverId=…` links keep working after a new version is published.
- Send waiver from the POS accepts `kind: "MEMBERSHIP"` (defaults to the class waiver).

**Migration:** `20260923120000_waivers-and-kinds` (additive: new `Waiver` table,
nullable `WaiverVersion.waiverId`, `locationId` made nullable, the old
`(locationId, version)` unique swapped for `(waiverId, version)`, data backfilled
in the same migration). Run on production, from a machine with the Neon URL:

```
npx prisma migrate deploy
npx prisma migrate status
```

## 2. Piece intake: customers scan a QR code

- Admin → Pieces → **Print QR poster** prints one poster per studio. Each QR opens
  `/pieces/new?location=<studio>`. The customer signs in or creates an account,
  and the form already knows which studio the pieces are at, so it works for
  walk-ins with no booking on file. The session picker only appears when the
  customer has recent bookings.
- Login and Create account now return to the page the customer was going to
  (the QR link, a waiver link). Before this they always landed on the dashboard,
  which also broke the existing "text them the waiver link" flow.
- The desk form (`/admin/pieces/new`) stays as the backup for people who can't
  use their phone; the Pieces page says so.

## 3. Tips at checkout

- **Card reader:** the reader's tip screen is a Stripe account setting, not
  something the app can turn on per payment. The test account had it **off**,
  which is why no tip prompt ever appeared. Admin → Studio setup → Card readers now
  has a **Tip screen on the reader** switch (15 / 18 / 20 %, whole dollars under
  $10). Turn it on in production once, after deploying.
- **Other tenders** (Enter card, gift card, account credit): the POS shows a
  customer-facing tip screen before the tender, once per order. Comp skips it.
- **Never asks twice:** if a tip is already on the order (chosen on screen, or
  typed in with the cart's Add tip), the reader is told not to ask. Add tip stays
  as the manual backup and reads "Change tip" once one is set.

## After deploying

1. `npx prisma migrate deploy` (above).
2. Admin → Studio setup → Card readers → turn the reader tip screen on.
3. Admin → Waivers: create the membership waiver (All studios) so the membership
   gate becomes active.
4. Admin → Pieces → Print QR poster; put one up at each studio.
