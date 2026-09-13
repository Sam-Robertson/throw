// Pure transform: reads momence-export/sales.json and produces a clean,
// itemized list of paid session bookings, without touching the database.
// Review momence-export/mapped/sales-report.json before running sales:apply.
//
// Scope: only itemType "session" sale line items carry real revenue
// ($163,658.84 across 6,620 items). All 1,979 "appointment" items in this
// export are $0 (Open Studio / pickup / tour / private lesson bookings that
// carry no charge) — they are counted and skipped rather than mapped, since
// there is no revenue gap to close for them. Every other itemType
// (money-credit, membership, product, tips, refunds, gift-card, etc.) is
// also out of scope for this pass — each is its own reconciliation problem
// against rows that already exist (Tip, GiftCard, Membership), not a
// Booking backfill. See sales-report.json's `otherItemTypeCounts`.
//
// Run with:
//   npm run sales:map
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
  saleItemId: number;
  itemType: string;
  itemName: string;
  payingMember: { id: number; firstName: string; lastName: string };
  targetMember: { id: number; firstName: string; lastName: string };
  session?: { id: number; name: string; startsAt: string; endsAt: string };
  quantity: number;
  unitPriceExcludingTaxInCurrency: string;
  unitTaxAmountInCurrency: string;
  discountCode: string | null;
};
type PaymentTransactionItem = {
  paymentMethodType: string;
  paymentMethodName: string;
  amountInCurrencyWithoutTax: string;
  taxAmountInCurrency: string;
};
type Sale = {
  id: number;
  saleDate: string;
  items: SaleItem[];
  paymentTransaction: { items: PaymentTransactionItem[] } | null;
};

// Momence's per-sale payment method -> our 4-value BookingSource enum. There
// is no GIFT_CARD or split-payment source in our schema, so both collapse
// into DROP_IN (paid, not membership, not comp) — flagged per-occurrence in
// the report rather than silently absorbed.
function deriveSource(method: string): "COMP" | "MEMBERSHIP_CREDIT" | "DROP_IN" {
  if (method === "free" || method === "campaign-sequence-action") return "COMP";
  if (method === "membership") return "MEMBERSHIP_CREDIT";
  return "DROP_IN"; // stripe, stripe-reader, cash, stripe-ach-direct-debit, pay-later, pay-at-start, gift-card
}

function toCents(decimalString: string): number {
  return Math.round(parseFloat(decimalString) * 100);
}

type MappedSaleItem = {
  saleId: number;
  itemId: number;
  studioSessionId: string; // "mss_session_<momenceSessionId>"
  targetUserId: string; // "mu_<momenceMemberId>" — the attendee, who the booking belongs to
  payingUserId: string; // "mu_<momenceMemberId>" — who actually paid (may differ, e.g. one member buying seats for others)
  saleDate: string;
  amountCents: number; // pre-tax: unitPriceExcludingTax * quantity, in cents
  taxCents: number;
  source: "COMP" | "MEMBERSHIP_CREDIT" | "DROP_IN";
  paymentMethodType: string;
  discountCode: string | null;
};

const report = {
  generatedAt: new Date().toISOString(),
  totalSales: 0,
  saleDateRange: { earliest: "", latest: "" },
  itemTypeCounts: {} as Record<string, number>,
  sessionItems: {
    total: 0,
    mapped: 0,
    missingSessionSubObject: 0,
  },
  appointmentItemsSkipped: {
    count: 0,
    totalRevenue: 0,
    note: "All appointment-type sale items in this export are $0 — no revenue gap to close, so they are not mapped.",
  },
  otherItemTypeCounts: {} as Record<string, number>,
  reconciliation: {
    // Per-sale check: sum(unitPriceExcludingTax * qty) across all items vs.
    // paymentTransaction total (amountInCurrencyWithoutTax). A mismatch means
    // this script's amount-per-item assumption is wrong for that sale, not a
    // rounding artifact — those sales are listed for manual review, not
    // silently dropped or auto-corrected.
    salesChecked: 0,
    matched: 0,
    mismatched: [] as { saleId: number; lineSum: number; txTotal: number }[],
  },
  paymentMethodCounts: {} as Record<string, number>,
  gitCardOrSplitPaymentFlaggedAsDropIn: [] as { saleId: number; itemId: number; method: string }[],
  multiMethodSales: [] as number[], // sale ids where >1 distinct payment method appeared; first method used
  caveats: [
    "amountCents is PRE-TAX (unitPriceExcludingTaxInCurrency * quantity). Our schema has no tax field on Booking or Payment, and pre-tax is what dropInPriceCents represents elsewhere in this app, so this keeps the two consistent.",
    "source is derived from the sale's payment method, not guessed: free/campaign-sequence-action -> COMP, membership -> MEMBERSHIP_CREDIT, everything else (stripe, stripe-reader, cash, ach, pay-later, gift-card) -> DROP_IN. Our BookingSource enum has no gift-card or split-payment value, so those collapse into DROP_IN — see gitCardOrSplitPaymentFlaggedAsDropIn.",
    "Booking is credited to targetMember (the attendee), not payingMember (who paid) — one person can buy seats for others. payingUserId is carried through for the Payment record's metadata, not used as the Booking's userId.",
    "This is a snapshot through the export date, not a closed historical dataset — sales continue to accrue after this file was generated. See saleDateRange.",
  ],
};

function main() {
  const sales = readJson<Sale[]>("sales");
  report.totalSales = sales.length;

  const dates = sales.map((s) => s.saleDate).sort();
  report.saleDateRange = { earliest: dates[0], latest: dates[dates.length - 1] };

  const mapped: MappedSaleItem[] = [];

  for (const sale of sales) {
    const txItems = sale.paymentTransaction?.items ?? [];
    const distinctMethods = [...new Set(txItems.map((t) => t.paymentMethodType))];
    if (distinctMethods.length > 1) report.multiMethodSales.push(sale.id);
    const dominantMethod = distinctMethods[0] ?? "free"; // sales with no paymentTransaction (fully comp) default to free

    let lineSum = 0;
    for (const item of sale.items) {
      report.itemTypeCounts[item.itemType] = (report.itemTypeCounts[item.itemType] ?? 0) + 1;
      lineSum += parseFloat(item.unitPriceExcludingTaxInCurrency || "0") * (item.quantity || 1);

      if (item.itemType === "appointment") {
        report.appointmentItemsSkipped.count++;
        report.appointmentItemsSkipped.totalRevenue +=
          parseFloat(item.unitPriceExcludingTaxInCurrency || "0") * (item.quantity || 1);
        continue;
      }

      if (item.itemType !== "session") {
        report.otherItemTypeCounts[item.itemType] = (report.otherItemTypeCounts[item.itemType] ?? 0) + 1;
        continue;
      }

      report.sessionItems.total++;
      if (!item.session) {
        report.sessionItems.missingSessionSubObject++;
        continue;
      }

      report.paymentMethodCounts[dominantMethod] = (report.paymentMethodCounts[dominantMethod] ?? 0) + 1;
      const source = deriveSource(dominantMethod);
      if (dominantMethod === "gift-card" || distinctMethods.length > 1) {
        report.gitCardOrSplitPaymentFlaggedAsDropIn.push({ saleId: sale.id, itemId: item.id, method: dominantMethod });
      }

      mapped.push({
        saleId: sale.id,
        itemId: item.id,
        studioSessionId: `mss_session_${item.session.id}`,
        targetUserId: `mu_${item.targetMember.id}`,
        payingUserId: `mu_${item.payingMember.id}`,
        saleDate: sale.saleDate,
        amountCents: toCents(item.unitPriceExcludingTaxInCurrency) * (item.quantity || 1),
        taxCents: toCents(item.unitTaxAmountInCurrency) * (item.quantity || 1),
        source,
        paymentMethodType: dominantMethod,
        discountCode: item.discountCode,
      });
      report.sessionItems.mapped++;
    }

    const txTotal = txItems.reduce((sum, t) => sum + parseFloat(t.amountInCurrencyWithoutTax || "0"), 0);
    report.reconciliation.salesChecked++;
    if (Math.abs(lineSum - txTotal) < 0.02) {
      report.reconciliation.matched++;
    } else {
      report.reconciliation.mismatched.push({ saleId: sale.id, lineSum: Math.round(lineSum * 100) / 100, txTotal: Math.round(txTotal * 100) / 100 });
    }
  }

  writeJson("sales-items", mapped);
  writeJson("sales-report", report);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nMapped ${mapped.length} session sale items to ${OUT_DIR}/sales-items.json`);
  console.log("No database writes were made. Review sales-report.json before running sales:apply.");
}

main();
