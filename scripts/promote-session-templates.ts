// SessionType.isTemplate now defaults to false — every one of the 52 class
// types carried over from Momence starts as a one-off, since most of them
// really are (dated fragments, single workshops, private events that survived
// the earlier merge). This promotes the ones that have actually recurred:
// >=3 non-cancelled StudioSessions ever, OR >=2 sessions spanning more than
// 30 days apart. That's a real recurring class, not a one-time thing.
//
// Dry-run by default — review the promote list below, then re-run with
// --apply. Safe to re-run: only flips isTemplate from false to true, never
// touches anything already true.
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/promote-session-templates.ts
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/promote-session-templates.ts --apply
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const MIN_SESSION_COUNT = 3;
const MIN_SPAN_DAYS = 30;

const prisma = new PrismaClient();

async function main() {
  const sessionTypes = await prisma.sessionType.findMany({
    where: { isTemplate: false },
    include: {
      studioSessions: {
        where: { isCancelled: false },
        select: { startsAt: true },
      },
      location: { select: { name: true } },
    },
  });

  const toPromote: { id: string; name: string; location: string | null; count: number; spanDays: number }[] = [];

  for (const st of sessionTypes) {
    const count = st.studioSessions.length;
    const dates = st.studioSessions.map((s) => s.startsAt.getTime()).sort((a, b) => a - b);
    const spanDays = dates.length >= 2 ? (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24) : 0;

    const shouldPromote = count >= MIN_SESSION_COUNT || (dates.length >= 2 && spanDays > MIN_SPAN_DAYS);
    if (shouldPromote) {
      toPromote.push({ id: st.id, name: st.name, location: st.location?.name ?? null, count, spanDays: Math.round(spanDays) });
    }
  }

  console.log(`${sessionTypes.length} class types currently isTemplate:false`);
  console.log(`${toPromote.length} would be promoted to isTemplate:true:\n`);
  for (const p of toPromote) {
    console.log(`  ${p.name} (${p.location ?? "no location"}) — ${p.count} sessions, span ${p.spanDays}d`);
  }
  console.log(`\n${sessionTypes.length - toPromote.length} remain one-offs.`);

  if (!APPLY) {
    console.log("\nDry run only — no database writes were made. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  for (const p of toPromote) {
    await prisma.sessionType.update({ where: { id: p.id }, data: { isTemplate: true } });
  }
  console.log(`\nPromoted ${toPromote.length} class types.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
