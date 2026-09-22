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

**2026-09-21, second pass.** Sam ran `catalog:sync-class-types --apply` with the
first (too broad) catalog. The scripts were then cut down to what the website sells
(`docs/throw-catalog.md` section 0) and now also archive what that first run added.
Re-run all four, in this order. Each prints its plan and changes nothing without
`--apply`; each is safe to run twice.

```bash
cd ~/Desktop/throw          # .env points at production

npm run catalog:sync-class-types -- --apply    # archives 10 more types -> 7 active
npm run catalog:backfill-series -- --apply     # groups course sessions into cohorts
npm run sync:products -- --apply               # 6 products + GRAND30
npm run sync:plans -- --apply                  # Basic/Pro/Expert x 2 studios
```

Expected (rehearsed on a local copy in the same state as production):
- Class types: 7 active (Clay Together, Kickstart, Group Event, Kids Summer Camp, the
  two Lehi courses, Busy Window). The 10 member/workshop/private-lesson types from
  the first run are archived; their ~430 upcoming placeholder sessions (no bookings)
  stay in place, hidden.
- Series: Lehi Kickstart Mondays and After-School Wednesdays grouped. Two Momence
  "container" rows (Oct 5 → Oct 26, Oct 7 → Nov 11) are listed: cancel them in
  Admin › Schedule.
- Products: 3 pieces + 3 class packs created, GRAND30 created and linked to Lehi.
- Plans: 6 created; the dev-seed plans and the still-active Momence plan retired.

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
