// Reads momence-export/mapped/sales-items.json (from sales:map) and backfills
// real historical payment amounts:
//   - Booking.source / Booking.amountPaidCents, for every Booking that was
//     imported with the DROP_IN/$0 placeholder (momence-map.ts's honest
//     stand-in for the /sales endpoint being 403'd at the time).
//   - a Payment row per sale item, so the Revenue view has real rows to
//     aggregate — linked to the matched Booking where one exists, or
//     standalone (bookingId: null) when the sale has no corresponding
//     Booking row at all (Momence's /session-bookings endpoint simply never
//     returned one, even though the sale itself is real).
//
// Every write is idempotent:
//   - Booking is only updated while amountPaidCents is still 0 (the
//     placeholder) — a booking already carrying a real amount (from a prior
//     run of this script, or a genuinely live booking) is left untouched.
//   - Payment rows use a deterministic id (`pay_ms_<saleId>_<itemId>`) and
//     are written via createMany({skipDuplicates:true}), so re-running is
//     always safe.
//
// Run momence:apply first (Booking/StudioSession/User rows must already
// exist), then:
//   npm run sales:map      (dry run — review momence-export/mapped/sales-report.json)
//   npm run sales:apply           (dry run — prints planned counts, no writes)
//   npm run sales:apply -- --apply  (writes)
import fs from "fs";
import path from "path";
import { PrismaClient, BookingSource, PaymentType, Prisma } from "@prisma/client";

const MAPPED_DIR = path.join(__dirname, "..", "momence-export", "mapped");
const CHUNK_SIZE = 1000;
const APPLY = process.argv.includes("--apply");

// Lehi has no wheel inventory / session history yet — same fallback used by
// momence-map.ts for resource sub-locations with no location on the source row.
const FALLBACK_LOCATION_ID = "cmphmu63k0009owhcb64gluxc"; // Provo

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(MAPPED_DIR, `${name}.json`), "utf8"));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

type MappedSaleItem = {
  saleId: number;
  itemId: number;
  studioSessionId: string;
  targetUserId: string;
  payingUserId: string;
  saleDate: string;
  amountCents: number;
  taxCents: number;
  source: "COMP" | "MEMBERSHIP_CREDIT" | "DROP_IN";
  paymentMethodType: string;
  discountCode: string | null;
};

function paymentTypeFor(source: MappedSaleItem["source"]): PaymentType {
  if (source === "MEMBERSHIP_CREDIT") return PaymentType.MEMBERSHIP;
  if (source === "DROP_IN") return PaymentType.DROP_IN;
  return PaymentType.OTHER; // COMP
}

const prisma = new PrismaClient();

async function main() {
  const items = readJson<MappedSaleItem[]>("sales-items");

  const neededSessionIds = [...new Set(items.map((i) => i.studioSessionId))];
  const studioSessions = await prisma.studioSession.findMany({
    where: { id: { in: neededSessionIds } },
    select: { id: true, locationId: true },
  });
  const sessionById = new Map(studioSessions.map((s) => [s.id, s]));

  const neededUserIds = [...new Set([...items.map((i) => i.targetUserId), ...items.map((i) => i.payingUserId)])];
  const users = await prisma.user.findMany({ where: { id: { in: neededUserIds } }, select: { id: true } });
  const existingUserIds = new Set(users.map((u) => u.id));

  const bookings = await prisma.booking.findMany({
    where: { studioSessionId: { in: neededSessionIds } },
    select: { id: true, userId: true, studioSessionId: true, amountPaidCents: true },
  });
  const bookingByKey = new Map(bookings.map((b) => [`${b.studioSessionId}::${b.userId}`, b]));

  const report = {
    totalItems: items.length,
    skippedSessionNotFound: 0,
    skippedUserNotFound: 0,
    bookingsToUpdate: 0,
    bookingsAlreadyBackfilled: 0,
    standaloneNoBooking: 0,
    revenueCentsPlanned: 0,
    revenueCentsSkipped: 0,
  };

  const bookingUpdates: { bookingId: string; source: BookingSource; amountPaidCents: number; stripePaymentIntentId: string }[] = [];
  const paymentRows: {
    id: string;
    userId: string;
    locationId: string;
    stripePaymentIntentId: string;
    amountInCents: number;
    status: "SUCCEEDED";
    type: PaymentType;
    bookingId: string | null;
    metadata: Prisma.InputJsonValue;
    createdAt: Date;
  }[] = [];

  for (const item of items) {
    const session = sessionById.get(item.studioSessionId);
    if (!session) {
      report.skippedSessionNotFound++;
      report.revenueCentsSkipped += item.amountCents;
      continue;
    }
    if (!existingUserIds.has(item.targetUserId)) {
      report.skippedUserNotFound++;
      report.revenueCentsSkipped += item.amountCents;
      continue;
    }

    const paymentIntentId = `momence_sale_${item.saleId}_${item.itemId}`;
    const booking = bookingByKey.get(`${item.studioSessionId}::${item.targetUserId}`);

    if (booking) {
      if (booking.amountPaidCents === 0) {
        bookingUpdates.push({
          bookingId: booking.id,
          source: BookingSource[item.source],
          amountPaidCents: item.amountCents,
          stripePaymentIntentId: paymentIntentId,
        });
        report.bookingsToUpdate++;
      } else {
        report.bookingsAlreadyBackfilled++;
      }
    } else {
      report.standaloneNoBooking++;
    }

    report.revenueCentsPlanned += item.amountCents;

    paymentRows.push({
      id: `pay_ms_${item.saleId}_${item.itemId}`,
      userId: existingUserIds.has(item.payingUserId) ? item.payingUserId : item.targetUserId,
      locationId: session.locationId ?? FALLBACK_LOCATION_ID,
      stripePaymentIntentId: paymentIntentId,
      amountInCents: item.amountCents,
      status: "SUCCEEDED",
      type: paymentTypeFor(item.source),
      bookingId: booking?.id ?? null,
      metadata: {
        momenceSaleId: item.saleId,
        momenceSaleItemId: item.itemId,
        targetUserId: item.targetUserId,
        payingUserId: item.payingUserId,
        paymentMethodType: item.paymentMethodType,
        discountCode: item.discountCode,
      },
      createdAt: new Date(item.saleDate),
    });
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nRevenue planned: $${(report.revenueCentsPlanned / 100).toFixed(2)}`);
  console.log(`Revenue skipped (unresolved session/user): $${(report.revenueCentsSkipped / 100).toFixed(2)}`);

  if (!APPLY) {
    console.log("\nDry run only — no database writes were made. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  for (const c of chunk(bookingUpdates, CHUNK_SIZE)) {
    for (const u of c) {
      await prisma.booking.update({
        where: { id: u.bookingId },
        data: {
          source: u.source,
          amountPaidCents: u.amountPaidCents,
          stripePaymentIntentId: u.stripePaymentIntentId,
        },
      });
    }
  }
  console.log(`Updated ${bookingUpdates.length} bookings.`);

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
