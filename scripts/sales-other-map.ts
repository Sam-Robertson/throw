// Pure transform: reads momence-export/sales.json and maps every NON-session
// revenue category into standalone Payment rows. sales-map.ts/sales-apply.ts
// only ever handled itemType "session" (backfilling Booking amounts) — this
// is why the app's Total/Membership Revenue looked far lower than Momence's
// own reporting: membership (subscription) charges, retail product sales,
// tips, gift cards, and membership fees were never imported at all.
//
// Scope: membership, product, tips, gift-card, membership-joining-fee,
// membership-freeze-fee, course, money-credit, event-credit. Each becomes a
// standalone Payment (no Booking/Membership linkage attempted — that's a
// separate reconciliation problem per category). Excluded: "appointment"
// (always $0, see sales-map.ts), "refund"/"stripe-refund" (already a
// negative-signed echo of an original sale — Momence's own "Total sales"
// figure is gross, not net of refunds, so including these would double-count
// the reduction).
//
// Run with:
//   npm run sales:other:map
import fs from "fs";
import path from "path";

const EXPORT_DIR = path.join(__dirname, "..", "momence-export");
const OUT_DIR = path.join(EXPORT_DIR, "mapped");

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, `${name}.json`), "utf8"));
}

function writeJson(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

type SaleItem = {
  id: number;
  itemType: string;
  itemName: string;
  payingMember: { id: number };
  targetMember: { id: number };
  quantity: number;
  unitPriceExcludingTaxInCurrency: string;
  unitTaxAmountInCurrency: string;
  discountCode: string | null;
};
type Sale = { id: number; saleDate: string; items: SaleItem[] };

const INCLUDED_TYPES = new Set([
  "membership",
  "product",
  "tips",
  "gift-card",
  "membership-joining-fee",
  "membership-freeze-fee",
  "course",
  "money-credit",
  "event-credit",
]);

function paymentTypeFor(itemType: string): "MEMBERSHIP" | "GIFT_CARD" | "TIP" | "OTHER" {
  if (itemType === "membership") return "MEMBERSHIP";
  if (itemType === "gift-card") return "GIFT_CARD";
  if (itemType === "tips") return "TIP";
  return "OTHER";
}

function toCents(decimalString: string): number {
  return Math.round(parseFloat(decimalString) * 100);
}

type MappedItem = {
  saleId: number;
  itemId: number;
  itemType: string;
  itemName: string;
  payingUserId: string; // "mu_<momenceMemberId>" — Payment.userId (who paid)
  amountCents: number;
  paymentType: "MEMBERSHIP" | "GIFT_CARD" | "TIP" | "OTHER";
  saleDate: string;
  discountCode: string | null;
};

const report = {
  generatedAt: new Date().toISOString(),
  totalSales: 0,
  itemTypeCounts: {} as Record<string, number>,
  itemTypeTotalsCents: {} as Record<string, number>,
  mapped: 0,
  excludedRefundCents: 0,
  excludedAppointmentCents: 0,
  caveats: [
    "No Booking or Membership linkage is attempted here — every row is a standalone Payment attributed to the paying member. Matching a membership charge to a specific Membership period, or a product sale to a specific PosOrder, is a separate follow-up, not done in this pass.",
    "refund/stripe-refund itemTypes are excluded entirely. They appear as their own negative-valued sale in Momence's export (an echo of an earlier charge), and Momence's own 'Total sales' figure does not net them out either.",
    "appointment itemType is excluded — every appointment sale item in this export is $0 (Open Studio, pickup, tour, private lesson bookings carry no charge).",
  ],
};

function main() {
  const sales = readJson<Sale[]>("sales");
  report.totalSales = sales.length;

  const mapped: MappedItem[] = [];

  for (const sale of sales) {
    for (const item of sale.items) {
      report.itemTypeCounts[item.itemType] = (report.itemTypeCounts[item.itemType] ?? 0) + 1;
      const cents = toCents(item.unitPriceExcludingTaxInCurrency) * (item.quantity || 1);
      report.itemTypeTotalsCents[item.itemType] = (report.itemTypeTotalsCents[item.itemType] ?? 0) + cents;

      if (item.itemType === "refund" || item.itemType === "stripe-refund") {
        report.excludedRefundCents += cents;
        continue;
      }
      if (item.itemType === "appointment") {
        report.excludedAppointmentCents += cents;
        continue;
      }
      if (!INCLUDED_TYPES.has(item.itemType)) continue;

      mapped.push({
        saleId: sale.id,
        itemId: item.id,
        itemType: item.itemType,
        itemName: item.itemName,
        payingUserId: `mu_${item.payingMember.id}`,
        amountCents: cents,
        paymentType: paymentTypeFor(item.itemType),
        saleDate: sale.saleDate,
        discountCode: item.discountCode,
      });
      report.mapped++;
    }
  }

  writeJson("sales-other-items", mapped);
  writeJson("sales-other-report", report);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nMapped ${mapped.length} non-session sale items to ${OUT_DIR}/sales-other-items.json`);
  console.log("No database writes were made. Review sales-other-report.json before running sales:other:apply.");
}

main();
