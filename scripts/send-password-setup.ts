// Emails a "Set up your account" link to every CUSTOMER who has no password
// yet — in practice the members imported from Momence, who otherwise have no
// way to sign in. Uses the same token + email as /forgot-password
// (src/lib/email/passwordSetup.ts), so a link expires after 24 hours and a
// member can always get a fresh one from the sign-in page.
//
//   npm run members:invite -- --dry-run            (count + first 10, sends nothing)
//   npm run members:invite -- --limit 50           (first 50 not yet invited)
//   npm run members:invite -- --location <locId>   (only customers tied to that studio)
//   npm run members:invite -- --force              (also re-send to people holding a live link)
//
// A customer is tied to a location if they have a Booking at one of its
// sessions, or a Membership at that location or on a plan tied to it.
//
// Sends at most 10 emails per second. Anyone who already holds an unexpired
// link is skipped unless --force, so re-running after an interruption picks
// up where it stopped.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PASSWORD_TOKEN_TTL_MS, issuePasswordEmail, passwordTokenIdentifier } from "@/lib/email/passwordSetup";

const MAX_PER_SECOND = 10;
const MIN_INTERVAL_MS = 1000 / MAX_PER_SECOND;

interface Options {
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  locationId: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, force: false, limit: null, locationId: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n <= 0) throw new Error("--limit needs a positive whole number");
      options.limit = n;
    } else if (arg === "--location") {
      const id = argv[++i];
      if (!id || id.startsWith("--")) throw new Error("--location needs a Location id");
      options.locationId = id;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "unknown host";
    }
  })();
  console.log(`Database: ${db} @ ${host}`);

  if (options.locationId) {
    const location = await prisma.location.findUnique({ where: { id: options.locationId } });
    if (!location) throw new Error(`No Location with id ${options.locationId}`);
    console.log(`Location: ${location.name}`);
  }

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    hashedPassword: null,
    ...(options.locationId
      ? {
          OR: [
            { bookings: { some: { studioSession: { locationId: options.locationId } } } },
            {
              memberships: {
                some: {
                  OR: [{ locationId: options.locationId }, { plan: { locationId: options.locationId } }],
                },
              },
            },
          ],
        }
      : {}),
  };

  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, hashedPassword: true },
    orderBy: { createdAt: "asc" },
  });

  let alreadyInvited = 0;
  let toInvite = candidates;
  if (!options.force) {
    const liveTokens = await prisma.verificationToken.findMany({
      where: { identifier: { startsWith: "password-setup:" }, expires: { gt: new Date() } },
      select: { identifier: true },
    });
    const live = new Set(liveTokens.map((t) => t.identifier));
    toInvite = candidates.filter((u) => !live.has(passwordTokenIdentifier(u.email)));
    alreadyInvited = candidates.length - toInvite.length;
  }
  if (options.limit !== null) toInvite = toInvite.slice(0, options.limit);

  console.log(`Customers without a password: ${candidates.length}`);
  if (!options.force) {
    console.log(`Skipped (already hold a link valid for up to ${PASSWORD_TOKEN_TTL_MS / 3_600_000}h): ${alreadyInvited}`);
  }
  console.log(`Will email: ${toInvite.length}`);

  if (options.dryRun) {
    console.log("\nDry run — nothing sent. First 10:");
    for (const u of toInvite.slice(0, 10)) console.log(`  ${u.email}${u.name ? ` (${u.name})` : ""}`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — refusing to create links that can't be emailed.");
  }

  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const [i, user] of toInvite.entries()) {
    const startedAt = Date.now();
    const result = await issuePasswordEmail(user);
    if (result.sent) sent++;
    else failed.push({ email: user.email, error: result.error ?? "unknown error" });

    if ((i + 1) % 100 === 0) console.log(`  …${i + 1}/${toInvite.length} (${sent} sent, ${failed.length} failed)`);

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed.length}.`);
  for (const f of failed) console.log(`  FAILED ${f.email}: ${f.error}`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
