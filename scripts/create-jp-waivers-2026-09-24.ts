// One-off, 2026-09-24: creates the two waivers JP asked for, as All-studio
// documents, from the text of the existing Provo liability release:
//
//   Course waiver      CLASS, applies to courses only
//   Membership waiver  MEMBERSHIP, applies to every plan
//
// Both are marked as drafts in their staff note; JP replaces the text with
// "Publish new version" in Admin → Waivers. Skips a waiver that already
// exists by name, so it is safe to run twice.
//
//   npx tsx --tsconfig tsconfig.json scripts/create-jp-waivers-2026-09-24.ts
//
// Runs against DATABASE_URL in .env (production).

import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/richText";

const COMMON = `
<p><strong>1. ASSUMPTION OF RISK:</strong> Pottery and studio activities involve inherent risks including but not limited to burns from kilns, cuts from tools, slips on wet floors, and musculoskeletal strain. You voluntarily assume all such risks.</p>
<p><strong>2. RELEASE OF LIABILITY:</strong> You release Throw Art Studio, its owners, employees, and instructors from any and all claims arising from participation in studio activities, including claims of negligence.</p>
<p><strong>3. MEDICAL CONDITIONS:</strong> You confirm you have no medical condition that would prevent safe participation. You agree to inform staff of any relevant health concerns.</p>
<p><strong>4. PROPERTY:</strong> Throw Art Studio is not responsible for lost, stolen, or damaged personal property.</p>
<p><strong>5. PHOTOGRAPHY:</strong> You consent to being photographed during studio sessions for use in marketing materials. Notify staff if you do not consent.</p>
<p><strong>6. MINIMUM AGE:</strong> Participants under 18 must have a parent or guardian sign this waiver on their behalf.</p>`;

const COURSE = `
<h2>THROW ART STUDIO — COURSE PARTICIPATION WAIVER AND RELEASE</h2>
<p>By enrolling in a multi-week course at Throw Art Studio, you acknowledge and agree to the following:</p>
${COMMON}
<p><strong>7. COURSE ENROLLMENT:</strong> Your enrollment covers the sessions listed for your course. Sessions you miss are handled under the studio's course policy in effect at the time, and the studio may adjust dates or instructors when needed.</p>
<p><strong>8. YOUR PIECES:</strong> Work made during the course is dried, fired, and held for pickup under the studio's piece policy. Pieces not collected within the posted pickup window may be discarded or donated.</p>
<p>By signing below you confirm you have read, understood, and agree to these terms.</p>`;

const MEMBERSHIP = `
<h2>THROW ART STUDIO — MEMBERSHIP AGREEMENT AND RELEASE</h2>
<p>By starting a membership at Throw Art Studio, you acknowledge and agree to the following:</p>
${COMMON}
<p><strong>7. OPEN STUDIO ACCESS:</strong> Membership includes access to the studio outside class hours, when staff are usually not present. You agree to use wheels, kilns, and tools only as you have been trained, to follow the posted studio rules, to clean your workspace and shared areas before leaving, and to keep your access code or key to yourself. Guests are allowed only as your plan provides.</p>
<p><strong>8. SHELF SPACE AND WORK IN PROGRESS:</strong> Shelf space, where included, is for your own work in progress. Items left in the studio are at your own risk. When your membership ends, work left on your shelf or in the studio after the posted pickup window may be discarded or donated.</p>
<p><strong>9. BILLING AND CANCELLATION:</strong> Your plan's price, billing period, commitment term, freeze, and cancellation terms are the ones shown when you subscribe and in your account. Your membership renews automatically until cancelled under those terms.</p>
<p>By signing below you confirm you have read, understood, and agree to these terms.</p>`;

async function create(name: string, kind: string, appliesTo: string, description: string, html: string) {
  const existing = await prisma.waiver.findFirst({ where: { name, archivedAt: null } });
  if (existing) {
    console.log(`skip: "${name}" already exists`);
    return;
  }
  const w = await prisma.waiver.create({
    data: {
      name,
      kind,
      appliesTo,
      locationId: null,
      description,
      versions: {
        create: { locationId: null, content: sanitizeRichText(html), version: 1, publishedAt: new Date(), isActive: true },
      },
    },
    select: { id: true, name: true, kind: true, appliesTo: true, versions: { select: { id: true } } },
  });
  console.log(`created: ${w.name} | ${w.kind} | ${w.appliesTo} | waiverId=${w.id} versionId=${w.versions[0].id}`);
}

async function main() {
  const note = "Draft built from the Provo liability release on 2026-09-24. JP to review; replace via Publish new version.";
  await create("Course waiver", "CLASS", "COURSES", note, COURSE);
  await create("Membership waiver", "MEMBERSHIP", "ALL", note, MEMBERSHIP);
  const all = await prisma.waiver.findMany({
    where: { archivedAt: null },
    select: { name: true, kind: true, appliesTo: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  console.log("active waivers now:", all.map((w) => `${w.name} [${w.kind}/${w.appliesTo}/${w.location?.name ?? "All"}]`).join("; "));
}

main().finally(() => prisma.$disconnect());
