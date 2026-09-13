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

## Cross-workstream edits needed

(merged from `launch-notes/*.md` in Phase 3)
