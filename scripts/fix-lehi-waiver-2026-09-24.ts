// One-off, 2026-09-24: the Lehi class waiver's only version read "szdf".
// Publishes a new version of it with the current Provo class waiver text,
// the same way Admin → Waivers → Publish new version does (old version kept,
// deactivated). Does nothing if Lehi's current text is already the Provo text.
//
//   npx tsx --tsconfig tsconfig.json scripts/fix-lehi-waiver-2026-09-24.ts

import { prisma } from "@/lib/prisma";

async function main() {
  const provo = await prisma.waiverVersion.findFirstOrThrow({
    where: { isActive: true, waiver: { kind: "CLASS", archivedAt: null, location: { name: "Provo" } } },
    select: { content: true },
  });
  const lehi = await prisma.waiver.findFirstOrThrow({
    where: { kind: "CLASS", archivedAt: null, location: { name: "Lehi" } },
    select: { id: true, name: true, locationId: true, versions: { orderBy: { version: "desc" }, select: { version: true, isActive: true, content: true } } },
  });
  const current = lehi.versions.find((v) => v.isActive);
  if (current?.content === provo.content) {
    console.log(`skip: ${lehi.name} already has the Provo text`);
    return;
  }
  const nextVersion = (lehi.versions[0]?.version ?? 0) + 1;
  await prisma.$transaction(async (tx) => {
    await tx.waiverVersion.updateMany({ where: { waiverId: lehi.id, isActive: true }, data: { isActive: false } });
    await tx.waiverVersion.create({
      data: { waiverId: lehi.id, locationId: lehi.locationId, content: provo.content, version: nextVersion, publishedAt: new Date(), isActive: true },
    });
  });
  console.log(`published ${lehi.name} v${nextVersion} (${provo.content.length} chars); v${current?.version ?? "?"} ("${current?.content.replace(/<[^>]+>/g, "").trim()}") kept inactive`);
}

main().finally(() => prisma.$disconnect());
