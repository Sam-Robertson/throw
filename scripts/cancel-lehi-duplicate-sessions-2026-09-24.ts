// One-off, 2026-09-24: the Momence import left a one-session copy of a course
// next to each Lehi course series (same class type, same start, no seriesId).
// Cancels those orphans so they stop showing as bookable rows. Dry run by
// default; pass --apply to write. Refuses to touch a session with bookings.
//
//   npx tsx --tsconfig tsconfig.json scripts/cancel-lehi-duplicate-sessions-2026-09-24.ts [--apply]

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const lehi = await prisma.location.findFirstOrThrow({ where: { name: "Lehi" } });
  const orphans = await prisma.studioSession.findMany({
    where: { locationId: lehi.id, isCancelled: false, seriesId: null, startsAt: { gte: new Date() }, sessionType: { kind: "COURSE" } },
    select: { id: true, startsAt: true, sessionTypeId: true, sessionType: { select: { name: true } }, _count: { select: { bookings: true } } },
  });
  const targets: typeof orphans = [];
  for (const o of orphans) {
    const twin = await prisma.studioSession.findFirst({
      where: { locationId: lehi.id, isCancelled: false, seriesId: { not: null }, sessionTypeId: o.sessionTypeId, startsAt: o.startsAt, id: { not: o.id } },
      select: { id: true, seriesId: true },
    });
    if (!twin) { console.log(`keep   ${o.startsAt.toISOString()} ${o.sessionType.name} ${o.id}: no series twin`); continue; }
    if (o._count.bookings > 0) { console.log(`REFUSE ${o.startsAt.toISOString()} ${o.sessionType.name} ${o.id}: has ${o._count.bookings} booking(s)`); continue; }
    console.log(`${APPLY ? "cancel" : "would cancel"} ${o.startsAt.toISOString()} ${o.sessionType.name} ${o.id} (twin in ${twin.seriesId})`);
    targets.push(o);
  }
  if (APPLY && targets.length) {
    const r = await prisma.studioSession.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { isCancelled: true } });
    console.log(`cancelled ${r.count}`);
  } else if (!APPLY) {
    console.log(`dry run: ${targets.length} to cancel. Re-run with --apply.`);
  }
}
main().finally(() => prisma.$disconnect());
