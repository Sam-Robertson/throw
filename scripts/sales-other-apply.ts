// Reads momence-export/mapped/sales-other-items.json (from sales:other:map)
// and writes one standalone Payment per item — membership charges, retail
// product sales, tips, gift cards, and membership fees. See sales-other-map.ts
// for scope/exclusions.
//
// Idempotent: Payment rows use a deterministic id (`pay_ms_<saleId>_<itemId>`,
// same scheme as sales-apply.ts) and are written via
// createMany({skipDuplicates:true}), so re-running is always safe. Items
// whose payingMember was never imported as a User (no email in Momence) are
// skipped and counted, not guessed.
//
// Run:
//   npm run sales:other:map      (dry run — review momence-export/mapped/sales-other-report.json)
//   npm run sales:other:apply           (dry run — prints planned counts, no writes)
//   npm run sales:other:apply -- --apply  (writes)
import fs from "fs";
import path from "path";
import { PrismaClient, PaymentType, Prisma } from "@prisma/client";

const MAPPED_DIR = path.join(__dirname, "..", "momence-export", "mapped");
const CHUNK_SIZE = 1000;
const APPLY = process.argv.includes("--apply");

const FALLBACK_LOCATION_ID = "cmphmu63k0009owhcb64gluxc"; // Provo — no location on these sale items

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(MAPPED_DIR, `${name}.json`), "utf8"));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

type MappedItem = {
  saleId: number;
  itemId: number;
  itemType: string;
  itemName: string;
  payingUserId: string;
  amountCents: number;
  paymentType: "MEMBERSHIP" | "GIFT_CARD" | "TIP" | "OTHER";
  saleDate: string;
  discountCode: string | null;
};

const prisma = new PrismaClient();

async function main() {
  const items = readJson<MappedItem[]>("sales-other-items");

  const neededUserIds = [...new Set(items.map((i) => i.payingUserId))];
  const users = await prisma.user.findMany({ where: { id: { in: neededUserIds } }, select: { id: true } });
  const existingUserIds = new Set(users.map((u) => u.id));

  const report = {
    totalItems: items.length,
    skippedUserNotFound: 0,
    revenueCentsPlanned: 0,
    revenueCentsSkipped: 0,
    byType: {} as Record<string, { count: number; cents: number }>,
  };

  const paymentRows: {
    id: string;
    userId: string;
    locationId: string;
    stripePaymentIntentId: string;
    amountInCents: number;
    status: "SUCCEEDED";
    type: PaymentType;
    metadata: Prisma.InputJsonValue;
    createdAt: Date;
  }[] = [];

  for (const item of items) {
    if (!existingUserIds.has(item.payingUserId)) {
      report.skippedUserNotFound++;
      report.revenueCentsSkipped += item.amountCents;
      continue;
    }

    report.revenueCentsPlanned += item.amountCents;
    const bucket = report.byType[item.itemType] ?? { count: 0, cents: 0 };
    bucket.count++;
    bucket.cents += item.amountCents;
    report.byType[item.itemType] = bucket;

    paymentRows.push({
      id: `pay_ms_${item.saleId}_${item.itemId}`,
      userId: item.payingUserId,
      locationId: FALLBACK_LOCATION_ID,
      stripePaymentIntentId: `momence_sale_${item.saleId}_${item.itemId}`,
      amountInCents: item.amountCents,
      status: "SUCCEEDED",
      type: PaymentType[item.paymentType],
      metadata: {
        momenceSaleId: item.saleId,
        momenceSaleItemId: item.itemId,
        itemType: item.itemType,
        itemName: item.itemName,
        discountCode: item.discountCode,
      },
      createdAt: new Date(item.saleDate),
    });
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nRevenue planned: $${(report.revenueCentsPlanned / 100).toFixed(2)}`);
  console.log(`Revenue skipped (unresolved user): $${(report.revenueCentsSkipped / 100).toFixed(2)}`);

  if (!APPLY) {
    console.log("\nDry run only — no database writes were made. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  for (const c of chunk(paymentRows, CHUNK_SIZE)) {
    const result = await prisma.payment.createMany({ data: c, skipDuplicates: true });
    console.log(`Inserted ${result.count} payments (of ${c.length} in this chunk).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
