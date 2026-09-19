// Brings the class types that can be bought at checkout (POS drop-ins, the
// public schedule, online booking) in line with what throwartstudio.com
// actually sells, and retires the free Momence leftovers.
//
// After merge-session-types.ts there were still 52 class types, all active,
// 45 of them $0: piece pick-up slots, "Pay for Pottery Pieces", private
// parties, one-off events. None of those are checkout options.
//
// Prices are the ones on the live site (checked 2026-09-19):
//   Lehi nav  > Pottery Date Night / Wheel Experience   $35 per wheel
//   Lehi nav  > Kickstart (4 weeks)                     $200
//   Lehi nav  > Homeschool (6 weeks, ages 8-17)         $257
//   Lehi nav  > Afterschool (6 weeks, ages 8-17)        $257
//   Home page > Pottery Wheel Experience (Provo)        $29.99 per wheel
//   Home page > Pottery Kickstart (Provo)               $200
// Date night is the same class as the wheel experience on the site (the
// date-night page books the wheel-experience listing), so it is not a
// separate type. Cohort days/times live on the StudioSessions, not in the
// type name.
//
// What it does:
//   1. CATALOG  — sets name/price on the sellable types; creates a missing one.
//   2. MEMBER   — leaves member classes active at $0 (booked with class
//                 tickets; the app never sells a $0 type as a drop-in).
//   3. RETIRE   — sets isActive=false on every other $0 type. Nothing is
//                 deleted: sessions, bookings and history stay intact.
//   Priced types that are not in the catalog are listed for review, untouched.
//
// Always prints the plan. Pass --apply to actually write.
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/cleanup-checkout-catalog.ts
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/cleanup-checkout-catalog.ts --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type CatalogEntry = {
  /** Slug the type ends up with. */
  slug: string;
  /** Existing slugs this entry may currently be stored under (first match wins). */
  fromSlugs: string[];
  name: string;
  priceCents: number;
  /** Only used when the type has to be created. */
  create?: { durationMinutes: number; capacity: number; locationFromSlug: string };
};

const CATALOG: CatalogEntry[] = [
  {
    slug: "lehi-clay-together-pottery-wheel-experience",
    fromSlugs: ["lehi-clay-together-pottery-wheel-experience"],
    name: "Lehi - Clay Together - Pottery Wheel Experience",
    priceCents: 3500,
  },
  {
    slug: "lehi-beginner-pottery-kickstart",
    fromSlugs: ["lehi-beginner-pottery-kickstart"],
    name: "Lehi - Beginner Pottery Kickstart",
    priceCents: 20000,
  },
  {
    slug: "lehi-after-school-pottery-course",
    fromSlugs: ["lehi-after-school-pottery-course", "after-school-classes-12-18-oct-7-nov-11"],
    name: "Lehi - After-School Pottery Course (8-17)",
    priceCents: 25700,
  },
  {
    slug: "lehi-homeschool-pottery-course",
    fromSlugs: ["lehi-homeschool-pottery-course"],
    name: "Lehi - Homeschool Pottery Course (8-17)",
    priceCents: 25700,
    create: {
      durationMinutes: 120,
      capacity: 12,
      locationFromSlug: "lehi-beginner-pottery-kickstart",
    },
  },
  {
    slug: "provo-clay-together-pottery-wheel-experience",
    fromSlugs: ["provo-clay-together-pottery-wheel-experience"],
    name: "Provo - Clay Together - Pottery Wheel Experience",
    priceCents: 2999,
  },
  {
    slug: "beginner-pottery-kickstart",
    fromSlugs: ["beginner-pottery-kickstart"],
    name: "Beginner Pottery Kickstart",
    priceCents: 20000,
  },
];

// Member classes: free on purpose, booked with class tickets.
const MEMBER_SLUGS = new Set([
  "pottery-101-clay-prep-centering",
  "pottery-101-pulling-shaping",
  "pottery-101-trimming-add-ons",
  "pottery-101-glazing-finishing",
  "member-orientation",
  "member-event",
  "guided-pottery-time-members",
  "open-studio-members-only-multi-venue",
]);

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  const types = await prisma.sessionType.findMany({ orderBy: { name: "asc" } });
  const bySlug = new Map(types.map((t) => [t.slug, t]));

  const upcoming = await prisma.studioSession.groupBy({
    by: ["sessionTypeId"],
    where: { startsAt: { gte: new Date() }, isCancelled: false },
    _count: true,
  });
  const upcomingByType = new Map(upcoming.map((u) => [u.sessionTypeId, u._count]));

  const catalogIds = new Set<string>();
  let updated = 0;
  let created = 0;
  let retired = 0;

  console.log("CATALOG");
  for (const entry of CATALOG) {
    const existing = entry.fromSlugs.map((s) => bySlug.get(s)).find((t) => t !== undefined);

    if (!existing) {
      if (!entry.create) {
        console.log(`  MISSING  "${entry.name}" — no type with slug ${entry.fromSlugs.join(" / ")}; skipped`);
        continue;
      }
      const locationSource = bySlug.get(entry.create.locationFromSlug);
      if (!locationSource?.locationId) {
        console.log(`  MISSING  "${entry.name}" — can't find the studio to create it under; skipped`);
        continue;
      }
      created++;
      console.log(`  CREATE   "${entry.name}" at ${money(entry.priceCents)}`);
      if (APPLY) {
        const row = await prisma.sessionType.create({
          data: {
            name: entry.name,
            slug: entry.slug,
            durationMinutes: entry.create.durationMinutes,
            capacity: entry.create.capacity,
            dropInPriceCents: entry.priceCents,
            isActive: true,
            isTemplate: true,
            locationId: locationSource.locationId,
          },
        });
        catalogIds.add(row.id);
      }
      continue;
    }

    catalogIds.add(existing.id);
    const changes: string[] = [];
    if (existing.name !== entry.name) changes.push(`name "${existing.name}" -> "${entry.name}"`);
    if (existing.dropInPriceCents !== entry.priceCents) {
      changes.push(`price ${money(existing.dropInPriceCents)} -> ${money(entry.priceCents)}`);
    }
    if (!existing.isActive) changes.push("reactivated");
    if (changes.length === 0) {
      console.log(`  OK       "${entry.name}" ${money(entry.priceCents)}`);
      continue;
    }
    updated++;
    console.log(`  UPDATE   ${changes.join(", ")}`);
    if (APPLY) {
      await prisma.sessionType.update({
        where: { id: existing.id },
        data: {
          name: entry.name,
          slug: entry.slug,
          dropInPriceCents: entry.priceCents,
          isActive: true,
          isTemplate: true,
        },
      });
    }
  }

  const rest = types.filter((t) => !catalogIds.has(t.id));

  console.log("\nMEMBER (kept active at $0, booked with class tickets)");
  for (const t of rest.filter((t) => MEMBER_SLUGS.has(t.slug))) console.log(`  KEEP     "${t.name}"`);

  console.log("\nRETIRE (isActive -> false; nothing deleted)");
  const toRetire = rest.filter(
    (t) => !MEMBER_SLUGS.has(t.slug) && t.isActive && !t.isBusyWindow && t.dropInPriceCents === 0,
  );
  for (const t of toRetire) {
    const n = upcomingByType.get(t.id) ?? 0;
    console.log(`  RETIRE   "${t.name}"${n ? `  (${n} upcoming sessions leave the public schedule and POS)` : ""}`);
  }
  retired = toRetire.length;
  if (APPLY && toRetire.length > 0) {
    await prisma.sessionType.updateMany({
      where: { id: { in: toRetire.map((t) => t.id) } },
      data: { isActive: false, isTemplate: false },
    });
  }

  const review = rest.filter(
    (t) => !MEMBER_SLUGS.has(t.slug) && t.isActive && !t.isBusyWindow && t.dropInPriceCents > 0,
  );
  if (review.length > 0) {
    console.log("\nREVIEW (priced, not on the website — left untouched)");
    for (const t of review) {
      console.log(`  ?        "${t.name}" ${money(t.dropInPriceCents)}, ${upcomingByType.get(t.id) ?? 0} upcoming`);
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Plan"}: ${updated} updated, ${created} created, ${retired} retired. ` +
      `Active types after: ${types.filter((t) => t.isActive).length - retired + created}.`,
  );
  if (!APPLY) console.log("Dry run only — re-run with --apply to write these changes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
