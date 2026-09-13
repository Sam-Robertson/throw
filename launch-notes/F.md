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
