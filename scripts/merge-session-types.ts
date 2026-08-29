// One-time cleanup: the Momence import created a separate SessionType per
// exact session name, and Momence's own naming embedded the specific
// day/time/date-range of each recurring cohort directly in the name (e.g.
// "Beginner Pottery Kickstart - (Tuesday @ 3pm, August 4,11,18,25)"). That
// produced 66 near-duplicate types for what is really one recurring class.
// This merges those back down to one canonical type per real offering.
//
// Each StudioSession already carries its own capacity/date/time independent
// of SessionType, so merging types loses no per-occurrence data — only the
// template's own default capacity/duration/price gets consolidated (to the
// most common value across the merged group).
//
// Always prints the plan. Pass --apply to actually write.
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/merge-session-types.ts
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/merge-session-types.ts --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// Recognizes the date/time-fragmented naming patterns and returns the
// canonical series name, or the original name unchanged if it doesn't
// match one of those patterns (i.e. leave genuinely distinct one-off
// offerings — workshops, private events, core catalog types — alone).
function canonicalize(name: string): string {
  let m = name.match(/^((?:Lehi - )?(?:Beginner|Intermediate) Pottery Kickstart)\s*-\s*\(.*\)$/);
  if (m) return m[1];

  if (/Summer Camp|Summer Kids Camp/i.test(name) && !/Private Event/i.test(name)) {
    return "Summer Kids Camp";
  }

  m = name.match(/^(Spooky Clay Night.*?)\s*-\s*Friday.*$/);
  if (m) return m[1].trim();

  // Same walk-in class, renamed mid-stream (location word moved from
  // suffix to prefix) — not a date-fragmentation issue, but confirmed
  // with the studio as the same offering. Canonicalize to match the
  // "Lehi - Clay Together - Pottery Wheel Experience" naming convention.
  if (name === "Clay Together - Pottery Wheel Experience - Provo" || name === "Provo - Clay Together - Pottery Wheel Experience") {
    return "Provo - Clay Together - Pottery Wheel Experience";
  }

  // Condense the ~31 one-off specialty workshops (each a different topic
  // taught by a different instructor, one occurrence apiece) into a single
  // general "Workshop" class, per the studio's request. "Hand Building
  // Workshop" is excluded — that's a standing, actively-priced core catalog
  // class from before the Momence import, not a one-off named workshop.
  if (/workshop/i.test(name) && name !== "Hand Building Workshop") {
    return "General Workshop";
  }

  return name;
}

function mode<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [v, c] of counts) {
    // On a tie, prefer a non-zero value over zero (relevant for dropInPriceCents,
    // where "unpriced" 0s often outnumber the one real catalog price).
    if (c > bestCount || (c === bestCount && Number(v) > Number(best))) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

async function main() {
  const types = await prisma.sessionType.findMany({
    include: { _count: { select: { studioSessions: true } } },
    orderBy: { name: "asc" },
  });

  type Row = (typeof types)[number];
  const groups = new Map<string, { canon: string; locationId: string | null; members: Row[] }>();
  for (const t of types) {
    const canon = canonicalize(t.name);
    const key = `${canon}||${t.locationId ?? "null"}`;
    if (!groups.has(key)) groups.set(key, { canon, locationId: t.locationId, members: [] });
    groups.get(key)!.members.push(t);
  }

  let mergeCount = 0;
  let renameCount = 0;
  let sessionsRepointed = 0;
  let typesDeleted = 0;

  for (const group of groups.values()) {
    const changed = group.members.length > 1 || group.members[0].name !== group.canon;
    if (!changed) continue;

    if (group.members.length === 1) {
      renameCount++;
      const [only] = group.members;
      console.log(`RENAME: "${only.name}" -> "${group.canon}"`);
      if (APPLY) {
        await prisma.sessionType.update({
          where: { id: only.id },
          data: { name: group.canon, slug: slugify(group.canon) },
        });
      }
      continue;
    }

    mergeCount++;
    const survivor = [...group.members].sort(
      (a, b) => b._count.studioSessions - a._count.studioSessions || a.id.localeCompare(b.id)
    )[0];
    const others = group.members.filter((m) => m.id !== survivor.id);
    const totalSessions = group.members.reduce((s, m) => s + m._count.studioSessions, 0);

    const canonicalCapacity = mode(group.members.map((m) => m.capacity));
    const canonicalDuration = mode(group.members.map((m) => m.durationMinutes));
    const canonicalPrice = mode(group.members.map((m) => m.dropInPriceCents));

    console.log(
      `MERGE: "${group.canon}" <- ${group.members.length} types, ${totalSessions} sessions ` +
        `(survivor id ${survivor.id}, capacity ${canonicalCapacity}, duration ${canonicalDuration}min, price ${canonicalPrice}c)`
    );

    if (APPLY) {
      // Delete/repoint the other rows before renaming the survivor: the
      // canonical slug can collide with a slug an "other" row already
      // holds (e.g. it was already named the canonical way), which would
      // fail the update while that row still exists.
      const otherIds = others.map((o) => o.id);
      const { count } = await prisma.studioSession.updateMany({
        where: { sessionTypeId: { in: otherIds } },
        data: { sessionTypeId: survivor.id },
      });
      sessionsRepointed += count;
      const { count: deleted } = await prisma.sessionType.deleteMany({ where: { id: { in: otherIds } } });
      typesDeleted += deleted;

      await prisma.sessionType.update({
        where: { id: survivor.id },
        data: {
          name: group.canon,
          slug: slugify(group.canon),
          capacity: canonicalCapacity,
          durationMinutes: canonicalDuration,
          dropInPriceCents: canonicalPrice,
        },
      });
    } else {
      sessionsRepointed += totalSessions - survivor._count.studioSessions;
      typesDeleted += others.length;
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Plan"}: ${mergeCount} merge groups, ${renameCount} singleton renames, ` +
      `${typesDeleted} types ${APPLY ? "deleted" : "would be deleted"}, ` +
      `${sessionsRepointed} sessions ${APPLY ? "repointed" : "would be repointed"}.`
  );
  console.log(`Types before: ${types.length}. Types after: ${types.length - typesDeleted}.`);
  if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
