// Writes the rows extracted by scripts/sheets-map.py into the database.
// Does the User matching (by email for Form Responses, by normalized name
// for Shelf Spaces/waitlist) and only writes on a clean, unambiguous match —
// see the conversation for why: Shelf Spaces has no email column, and a
// wrong name match would put someone's info on the wrong shelf.
//
// Run with:
//   npm run sheets:apply
import fs from "fs";
import path from "path";
import { PrismaClient, Role, MembershipStatus } from "@prisma/client";
import crypto from "crypto";

const MAPPED_DIR = path.join(__dirname, "..", "sheets-export", "mapped");
const PROVO_LOCATION_ID = "cmphmu63k0009owhcb64gluxc";
// The sheet never distinguishes FULL vs HALF shelves — every ShelfSpace/
// ShelfWaitlistEntry created here defaults to this. Flagged for manual review.
const DEFAULT_SHELF_TYPE = "FULL";

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(MAPPED_DIR, `${name}.json`), "utf8"));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableUserId(email: string): string {
  return "sfu_" + crypto.createHash("md5").update(email).digest("hex").slice(0, 16);
}

const prisma = new PrismaClient();

async function main() {
  const formEmails = readJson<
    Record<string, { name: string | null; phone: string | null; firstSeen: string | null }>
  >("form-emails");
  const shelfOccupants = readJson<{ shelfNumber: number | null; name: string }[]>("shelf-occupants");
  const shelfWaitlist = readJson<{ position: number | null; name: string }[]>("shelf-waitlist");

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, phone: true } });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const byNormalizedName = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.name) continue;
    const key = normalizeName(u.name);
    const list = byNormalizedName.get(key) ?? [];
    list.push(u);
    byNormalizedName.set(key, list);
  }

  // ---- Form Responses -> User (update existing / create new) ------------
  let backfilled = 0;
  let created = 0;
  for (const [email, data] of Object.entries(formEmails)) {
    const existing = byEmail.get(email);
    if (existing) {
      const patch: { name?: string; phone?: string } = {};
      if (!existing.name && data.name) patch.name = data.name;
      if (!existing.phone && data.phone) patch.phone = data.phone;
      if (Object.keys(patch).length > 0) {
        await prisma.user.update({ where: { id: existing.id }, data: patch });
        backfilled++;
      }
    } else {
      const firstSeen = data.firstSeen ? new Date(data.firstSeen) : null;
      await prisma.user.create({
        data: {
          id: stableUserId(email),
          email,
          name: data.name,
          phone: data.phone,
          role: Role.CUSTOMER,
          createdAt: firstSeen && !Number.isNaN(firstSeen.getTime()) ? firstSeen : undefined,
        },
      });
      created++;
    }
  }
  console.log(`Form Responses: backfilled ${backfilled} existing users, created ${created} new users.`);

  // ---- Shelf Spaces -> ShelfSpace (clean matches only) -------------------
  let shelfCreated = 0;
  let shelfUpdated = 0;
  let shelfSkippedAmbiguous = 0;
  let shelfSkippedUnmatched = 0;
  let shelfSkippedNoActiveMembership = 0;

  for (const occupant of shelfOccupants) {
    if (!occupant.shelfNumber) continue;
    const matches = byNormalizedName.get(normalizeName(occupant.name));
    if (!matches) {
      shelfSkippedUnmatched++;
      continue;
    }
    if (matches.length > 1) {
      shelfSkippedAmbiguous++;
      continue;
    }
    const user = matches[0];

    const activeMemberships = await prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    const membershipId = activeMemberships.length === 1 ? activeMemberships[0].id : null;
    if (activeMemberships.length !== 1) shelfSkippedNoActiveMembership++;

    const notes = `Occupant: ${occupant.name}`;
    const existingShelf = await prisma.shelfSpace.findUnique({
      where: { locationId_number: { locationId: PROVO_LOCATION_ID, number: occupant.shelfNumber } },
    });

    if (existingShelf) {
      if (!existingShelf.membershipId && membershipId) {
        await prisma.shelfSpace.update({
          where: { id: existingShelf.id },
          data: { membershipId, notes: existingShelf.notes ?? notes },
        });
        shelfUpdated++;
      }
    } else {
      await prisma.shelfSpace.create({
        data: {
          locationId: PROVO_LOCATION_ID,
          number: occupant.shelfNumber,
          shelfType: DEFAULT_SHELF_TYPE,
          membershipId,
          notes,
        },
      });
      shelfCreated++;
    }
  }
  console.log(
    `Shelf Spaces: created ${shelfCreated}, updated ${shelfUpdated}, skipped (ambiguous name) ${shelfSkippedAmbiguous}, skipped (no match) ${shelfSkippedUnmatched}, missing a resolvable active membership ${shelfSkippedNoActiveMembership}.`
  );

  // ---- Shelf waitlist -> ShelfWaitlistEntry (clean matches only) --------
  let waitlistCreated = 0;
  let waitlistSkippedAmbiguous = 0;
  let waitlistSkippedUnmatched = 0;
  let waitlistSkippedNoActiveMembership = 0;

  for (const entry of shelfWaitlist) {
    const matches = byNormalizedName.get(normalizeName(entry.name));
    if (!matches) {
      waitlistSkippedUnmatched++;
      continue;
    }
    if (matches.length > 1) {
      waitlistSkippedAmbiguous++;
      continue;
    }
    const user = matches[0];
    const activeMemberships = await prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (activeMemberships.length !== 1) {
      waitlistSkippedNoActiveMembership++;
      continue; // ShelfWaitlistEntry.membershipId is required, can't create without one
    }

    const alreadyOnWaitlist = await prisma.shelfWaitlistEntry.findFirst({
      where: { membershipId: activeMemberships[0].id, locationId: PROVO_LOCATION_ID, resolvedAt: null },
    });
    if (alreadyOnWaitlist) continue;

    await prisma.shelfWaitlistEntry.create({
      data: {
        locationId: PROVO_LOCATION_ID,
        membershipId: activeMemberships[0].id,
        requestedType: DEFAULT_SHELF_TYPE,
      },
    });
    waitlistCreated++;
  }
  console.log(
    `Shelf waitlist: created ${waitlistCreated}, skipped (ambiguous name) ${waitlistSkippedAmbiguous}, skipped (no match) ${waitlistSkippedUnmatched}, skipped (no resolvable active membership) ${waitlistSkippedNoActiveMembership}.`
  );

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
