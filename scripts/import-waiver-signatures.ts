// Imports historical waiver signatures (e.g. from Momence) so existing
// customers aren't asked to sign again when they next book.
//
// CSV columns (header names matched loosely; detected mapping is printed):
// email, signed_at.
//
// Each matched customer gets one WaiverSignature against the current version
// of EVERY active studio's class waiver (so they're covered at Provo and Lehi),
// with source "momence", signedAt from the CSV, typedName from their account
// name, and no signature image. If a studio has no class waiver of its own, one
// is first created there with the text of the most recent class waiver
// elsewhere. Membership and other waivers are not imported.
//
// Run:
//   npm run import:waivers -- <file.csv> --dry-run    (prints plan, writes nothing)
//   npm run import:waivers -- <file.csv>              (writes)
//
// Safe to re-run: signatures are inserted with skipDuplicates on
// (userId, waiverVersionId), so anyone who already signed a version — here or
// in an earlier import — keeps their existing signature.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { detectColumns, parseArgs, parseCsv, parseDate, printMapping } from "./lib/csv";

const CHUNK_SIZE = 500;

const SYNONYMS = {
  email: ["email", "emailaddress", "customeremail", "memberemail", "clientemail"],
  signed_at: ["signedat", "signed", "signeddate", "datesigned", "signaturedate", "signedon", "createdat", "date"],
};

const prisma = new PrismaClient();

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2), []);
  const file = positional[0];
  const dryRun = flags.has("dry-run");
  if (!file) throw new Error("Usage: npm run import:waivers -- <file.csv> [--dry-run]");

  const [headers, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
  if (!headers) throw new Error(`${file} is empty`);
  const cols = detectColumns(headers, SYNONYMS);
  printMapping(headers, cols);
  if (cols.email === null || cols.signed_at === null) {
    throw new Error("The CSV must have an email column and a signed-at column.");
  }

  const cell = (row: string[], index: number | null) => (index === null ? "" : (row[index] ?? "").trim());

  // One signature date per email: when someone appears more than once, keep
  // their most recent signing.
  const skipped: { line: number; reason: string }[] = [];
  const signedAtByEmail = new Map<string, Date>();
  let duplicateRows = 0;
  rows.forEach((row, i) => {
    const line = i + 2;
    const email = cell(row, cols.email).toLowerCase();
    if (!email) return skipped.push({ line, reason: "blank email" });
    const raw = cell(row, cols.signed_at);
    const signedAt = parseDate(raw);
    if (!signedAt) return skipped.push({ line, reason: `invalid signed date "${raw}"` });
    const prior = signedAtByEmail.get(email);
    if (prior) duplicateRows++;
    if (!prior || signedAt > prior) signedAtByEmail.set(email, signedAt);
  });

  // Make sure every active studio has an active waiver to sign against.
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const activeVersions = await prisma.waiverVersion.findMany({
    where: { isActive: true, waiver: { kind: "CLASS", archivedAt: null } },
    orderBy: { publishedAt: "desc" },
    include: { waiver: { select: { locationId: true } } },
  });
  if (activeVersions.length === 0) {
    throw new Error("No active class waiver exists at any location; publish one before importing.");
  }
  const template = activeVersions[0];

  type Target = { locationId: string; locationName: string; versionId: string | null; toPublish: boolean };
  const targets: Target[] = [];
  for (const location of locations) {
    const version = activeVersions.find((v) => v.waiver?.locationId === location.id);
    targets.push({
      locationId: location.id,
      locationName: location.name,
      versionId: version?.id ?? null,
      toPublish: !version,
    });
  }

  // Match customers by email, case-insensitively.
  const emails = [...signedAtByEmail.keys()];
  const userByEmail = new Map<string, { id: string; name: string | null; email: string }>();
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const users = await prisma.user.findMany({
      where: { OR: chunk.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
      select: { id: true, name: true, email: true },
    });
    for (const u of users) {
      const key = u.email.toLowerCase();
      if (!userByEmail.has(key)) userByEmail.set(key, u);
    }
  }
  const notFound = emails.filter((e) => !userByEmail.has(e));
  const matched = emails.filter((e) => userByEmail.has(e));

  // Count signatures that already exist (for the report; skipDuplicates handles
  // them on write).
  const existingVersionIds = targets.map((t) => t.versionId).filter((id): id is string => id !== null);
  const matchedUserIds = matched.map((e) => userByEmail.get(e)!.id);
  const existingSignatures = existingVersionIds.length
    ? await prisma.waiverSignature.count({
        where: { waiverVersionId: { in: existingVersionIds }, userId: { in: matchedUserIds } },
      })
    : 0;

  console.log("");
  console.log(`Rows in CSV:            ${rows.length}`);
  console.log(`Skipped rows:           ${skipped.length}`);
  for (const s of skipped) console.log(`  line ${s.line}: ${s.reason}`);
  console.log(`Duplicate emails:       ${duplicateRows} (kept each person's most recent date)`);
  console.log(`Customers matched:      ${matched.length} of ${emails.length}`);
  console.log(`Customers not found:    ${notFound.length}`);
  for (const e of notFound) console.log(`  ${e}`);
  console.log("Studios:");
  for (const t of targets) {
    console.log(
      `  ${t.locationName}: ${
        t.toPublish ? `no class waiver; will create one with the text of v${template.version} from another studio` : "class waiver found"
      }`,
    );
  }
  console.log(
    `Signatures planned:     ${matched.length * targets.length} ` +
      `(${existingSignatures} already exist and will be left as they are)`,
  );

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  // Create any missing studio class waivers first, copying the template text.
  for (const t of targets.filter((target) => target.toPublish)) {
    const created = await prisma.waiver.create({
      data: {
        name: `${t.locationName} class waiver`,
        kind: "CLASS",
        locationId: t.locationId,
        versions: {
          create: {
            locationId: t.locationId,
            content: template.content,
            version: 1,
            publishedAt: new Date(),
            isActive: true,
          },
        },
      },
      include: { versions: true },
    });
    t.versionId = created.versions[0].id;
    console.log(`Created class waiver v1 at ${t.locationName}.`);
  }

  const data = matched.flatMap((email) => {
    const user = userByEmail.get(email)!;
    return targets.map((t) => ({
      userId: user.id,
      waiverVersionId: t.versionId!,
      signedAt: signedAtByEmail.get(email)!,
      ipAddress: "imported",
      typedName: user.name,
      signatureImageData: null,
      source: "momence",
    }));
  });

  let inserted = 0;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const result = await prisma.waiverSignature.createMany({
      data: data.slice(i, i + CHUNK_SIZE),
      skipDuplicates: true,
    });
    inserted += result.count;
  }
  console.log(`\nInserted ${inserted} waiver signatures.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
