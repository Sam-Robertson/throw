# Catalog deploy runbook

State as of 2026-09-21.

## Done

| Step | Result |
|---|---|
| Baseline check: `prisma migrate diff` of production against the `0_init` schema | "No difference detected" (checked 2026-09-19 and again 2026-09-21) |
| `npx prisma migrate resolve --applied 0_init` on production | Marked applied |
| `npx prisma migrate deploy` on production | Applied `launch-sept-2026`, `memberships-default-provo`, `catalog-accuracy`. `migrate status`: "Database schema is up to date" |
| Snapshot of the catalog tables before any data change | `backups/pre-catalog-sync-2026-09-21-17-18-22.json` (52 class types, 56 plans, the class type of each of 1,377 upcoming sessions). Git-ignored |
| Rehearsal of the three sync scripts, in order, twice, on a local copy of production's class types | Second pass reported no changes anywhere |
| Dry run of `catalog:sync-class-types` against production | Same plan as the rehearsal: 9 created, 8 kept, 44 archived, 653 upcoming sessions moved, nothing under REVIEW |

All three migrations are additive (new tables, new nullable or defaulted columns). The
code on `main` before this deploy keeps working against the migrated schema.

## To run: the catalog data sync (production)

These write catalog rows to the live database, so they are left for the owner to run.
Each prints its plan and changes nothing without `--apply`. Each is safe to run twice.
**Order matters**: the discounts link to class types created by the first script.

```bash
cd ~/Desktop/throw          # .env points at production

npm run catalog:sync-class-types              # read the plan
npm run catalog:sync-class-types -- --apply

npm run catalog:backfill-series               # read the plan
npm run catalog:backfill-series -- --apply

npm run sync:products                         # read the plan
npm run sync:products -- --apply

npm run sync:plans                            # read the plan
npm run sync:plans -- --apply
```

Expected:
- Class types: 52 active → 17 active, 44 archived, 653 upcoming sessions moved onto the
  canonical types. Past sessions, bookings and orders are not touched. Nothing deleted.
- Series: upcoming course sessions grouped into cohorts so a course sells as one line
  (Lehi Kickstart Mondays, After-School Wednesdays). It also lists two Momence "container"
  rows (Oct 5 → Oct 26 and Oct 7 → Nov 11) that are not real classes: cancel those two in
  Admin › Schedule so they stop appearing as bookable.
- Products and discounts: 35 rows created. No warnings if the class types ran first
  (FREEWHEEL, KICKSTART50 and GRAND30 link to Clay Together, Kickstart and Lehi).
- Plans: 19 rows created (6 standard, 3 founding, 3 legacy, 3 terms, guest pass, cap
  group, 2 freeze policies), and the four wrong active plans plus the imported Momence
  rows retired from public view. No membership or Stripe subscription is touched and
  no Stripe id is written.

Then spot-check with the queries at the top of `docs/catalog-verification.md`.

### Until the sync has run
The new code is safe on un-synced data but incomplete: the POS Pieces & Firing tab is
empty (no products), Provo classes don't list in the POS (still $0), and `/membership`
shows the same four plans it shows today.

### Undo
Class types: `backups/pre-catalog-sync-*.json` holds every `SessionType` row and the
original `sessionTypeId` of every upcoming session. Products, discounts and new plans
can simply be archived in admin. Neon point-in-time restore covers anything else.

## Code deploy
Merge `launch-sept-2026` into `main` and push; Vercel builds production from `main`
(`prisma generate && next build`).

## Owner-only items before go-live
See "Before go-live" in `docs/catalog-verification.md`: missing Vercel env vars, Stripe
Tax activation, a Stripe Terminal Location for Lehi, staff re-login, retail products.
