// Imports gift card balances (e.g. from Momence) as GiftCard rows, so they can
// be redeemed at the POS. Momence gift card *sales* were already imported as
// Payment rows by sales-other-apply.ts; this creates the redeemable balances.
//
// CSV columns (header names are matched loosely — case, spaces and
// underscores don't matter, and common variants are recognised; the detected
// mapping is printed): code, balance, purchaser_email, issued_at, expires_at.
// Only code and balance are required.
//
// Run:
//   npm run import:gift-cards -- <file.csv> --dry-run            (prints plan, writes nothing)
//   npm run import:gift-cards -- <file.csv>                      (writes)
//   npm run import:gift-cards -- <file.csv> --location <id>      (tag cards to a studio)
//
// Safe to re-run: rows are inserted with createMany({ skipDuplicates }) on the
// unique code, so cards already present are left untouched (their balances
// are NOT overwritten).
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { detectColumns, parseArgs, parseCsv, parseDate, parseDollarsToCents, printMapping } from "./lib/csv";

const CHUNK_SIZE = 500;

const SYNONYMS = {
  code: ["code", "giftcardcode", "cardcode", "vouchercode", "giftcardnumber", "cardnumber", "giftcard"],
  balance: ["balance", "remainingbalance", "currentbalance", "balanceremaining", "remaining", "amount", "value"],
  purchaser_email: ["purchaseremail", "buyeremail", "customeremail", "purchasedby", "purchaser", "email"],
  issued_at: ["issuedat", "issued", "issuedate", "purchasedat", "purchasedate", "createdat", "created", "date"],
  expires_at: ["expiresat", "expires", "expiry", "expirydate", "expiration", "expirationdate", "validuntil"],
};

const prisma = new PrismaClient();

async function main() {
  const { positional, flags, values } = parseArgs(process.argv.slice(2), ["location"]);
  const file = positional[0];
  const dryRun = flags.has("dry-run");
  const locationId = values.get("location") ?? null;
  if (!file) {
    throw new Error("Usage: npm run import:gift-cards -- <file.csv> [--dry-run] [--location <locationId>]");
  }

  if (locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw new Error(`No Location with id ${locationId}`);
    console.log(`Tagging imported cards to location: ${location.name}`);
  }

  const [headers, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
  if (!headers) throw new Error(`${file} is empty`);
  const cols = detectColumns(headers, SYNONYMS);
  printMapping(headers, cols);
  if (cols.code === null || cols.balance === null) {
    throw new Error("The CSV must have a code column and a balance column.");
  }

  const cell = (row: string[], index: number | null) => (index === null ? "" : (row[index] ?? "").trim());

  const skipped: { line: number; reason: string }[] = [];
  const seenCodes = new Set<string>();
  const parsed: {
    code: string;
    balanceCents: number;
    purchaserEmail: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
  }[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // 1-based, after the header
    const code = cell(row, cols.code).toUpperCase();
    if (!code) return skipped.push({ line, reason: "blank code" });
    if (seenCodes.has(code)) return skipped.push({ line, reason: `duplicate code ${code} in CSV` });

    const balanceCents = parseDollarsToCents(cell(row, cols.balance));
    if (balanceCents === null) {
      return skipped.push({ line, reason: `invalid balance "${cell(row, cols.balance)}"` });
    }

    const issuedRaw = cell(row, cols.issued_at);
    const issuedAt = parseDate(issuedRaw);
    if (issuedRaw && !issuedAt) return skipped.push({ line, reason: `invalid issued date "${issuedRaw}"` });

    const expiresRaw = cell(row, cols.expires_at);
    const expiresAt = parseDate(expiresRaw);
    if (expiresRaw && !expiresAt) return skipped.push({ line, reason: `invalid expiry date "${expiresRaw}"` });

    seenCodes.add(code);
    parsed.push({
      code,
      balanceCents,
      purchaserEmail: cell(row, cols.purchaser_email).toLowerCase() || null,
      issuedAt,
      expiresAt,
    });
  });

  // Match purchasers by email, case-insensitively.
  const emails = [...new Set(parsed.map((p) => p.purchaserEmail).filter((e): e is string => e !== null))];
  const userIdByEmail = new Map<string, string>();
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const users = await prisma.user.findMany({
      where: { OR: chunk.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
      select: { id: true, email: true },
    });
    for (const u of users) {
      const key = u.email.toLowerCase();
      if (!userIdByEmail.has(key)) userIdByEmail.set(key, u.id);
    }
  }
  const unmatchedPurchasers = emails.filter((e) => !userIdByEmail.has(e));

  const existing = new Set(
    (
      await prisma.giftCard.findMany({
        where: { code: { in: parsed.map((p) => p.code) } },
        select: { code: true },
      })
    ).map((g) => g.code),
  );
  const toInsert = parsed.filter((p) => !existing.has(p.code));
  const now = new Date();

  const data = toInsert.map((p) => ({
    code: p.code,
    // The CSV only carries the remaining balance; the original amount isn't
    // known, so initialCents is set to it too.
    initialCents: p.balanceCents,
    balanceCents: p.balanceCents,
    purchasedById: p.purchaserEmail ? (userIdByEmail.get(p.purchaserEmail) ?? null) : null,
    expiresAt: p.expiresAt,
    isActive: true,
    locationId,
    createdAt: p.issuedAt ?? now,
  }));

  const totalCents = data.reduce((sum, d) => sum + d.balanceCents, 0);
  console.log("");
  console.log(`Rows in CSV:              ${rows.length}`);
  console.log(`Valid rows:               ${parsed.length}`);
  console.log(`Skipped rows:             ${skipped.length}`);
  for (const s of skipped) console.log(`  line ${s.line}: ${s.reason}`);
  console.log(`Already in database:      ${existing.size}${existing.size ? ` (${[...existing].join(", ")})` : ""}`);
  console.log(`To insert:                ${data.length} cards, $${(totalCents / 100).toFixed(2)} total balance`);
  console.log(`  zero-balance cards:     ${data.filter((d) => d.balanceCents === 0).length}`);
  console.log(`Purchasers matched:       ${emails.length - unmatchedPurchasers.length} of ${emails.length}`);
  for (const e of unmatchedPurchasers) console.log(`  no user for ${e} (card imported without a purchaser)`);

  if (dryRun) {
    console.log("\nDry run: nothing written. First rows that would be inserted:");
    for (const d of data.slice(0, 5)) {
      console.log(
        `  ${d.code}  $${(d.balanceCents / 100).toFixed(2)}  purchaser=${d.purchasedById ?? "-"}  ` +
          `issued=${d.createdAt.toISOString()}  expires=${d.expiresAt?.toISOString() ?? "-"}`,
      );
    }
    return;
  }

  let inserted = 0;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const result = await prisma.giftCard.createMany({ data: data.slice(i, i + CHUNK_SIZE), skipDuplicates: true });
    inserted += result.count;
  }
  console.log(`\nInserted ${inserted} gift cards.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
