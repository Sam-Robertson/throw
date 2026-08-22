// One-time backfill for the class ticket ledger. Run manually with:
//   npx tsx prisma/backfill-tickets.ts
//
// For every ACTIVE/PAUSED membership on a finite-ticket plan that has no
// ledger entries yet, this grants the plan's period allowance and then
// spends it back down to match bookings that already happened under the old
// (unlimited) system, so existing members land on an accurate balance
// instead of a fresh full allowance they didn't earn.
import { prisma } from "../src/lib/prisma";

async function main() {
  const memberships = await prisma.membership.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    include: { plan: true },
  });

  let membershipsTouched = 0;
  let entriesCreated = 0;

  for (const membership of memberships) {
    if (membership.plan.classTicketsPerPeriod === null) continue; // unlimited plan — nothing to backfill

    const existingLedgerCount = await prisma.membershipCreditLedger.count({
      where: { membershipId: membership.id },
    });
    if (existingLedgerCount > 0) continue; // already backfilled or already live on the ledger system

    await prisma.membershipCreditLedger.create({
      data: {
        membershipId: membership.id,
        type: "ALLOWANCE",
        delta: membership.plan.classTicketsPerPeriod,
        periodStart: membership.currentPeriodStart,
        periodEnd: membership.currentPeriodEnd,
        note: "Backfilled period allowance",
      },
    });
    entriesCreated += 1;

    // Historical member bookings were all written with source MEMBER_FREE —
    // MEMBERSHIP_CREDIT didn't exist before this ledger system, so that's
    // the source value to look for here, not MEMBERSHIP_CREDIT. Cancelled
    // bookings are excluded: under the live system a cancellation outside
    // the 2-hour window refunds the ticket, netting to zero, so counting
    // them here would understate the backfilled balance.
    const consumedBookings = await prisma.booking.findMany({
      where: {
        membershipId: membership.id,
        source: "MEMBER_FREE",
        status: { in: ["CONFIRMED", "WAITLIST", "NO_SHOW"] },
        studioSession: {
          startsAt: {
            gte: membership.currentPeriodStart,
            lt: membership.currentPeriodEnd,
          },
        },
      },
      select: { id: true },
    });

    for (const booking of consumedBookings) {
      await prisma.membershipCreditLedger.create({
        data: {
          membershipId: membership.id,
          type: "BOOKING",
          delta: -1,
          bookingId: booking.id,
          periodStart: membership.currentPeriodStart,
          periodEnd: membership.currentPeriodEnd,
          note: "Backfilled from existing booking",
        },
      });
      entriesCreated += 1;
    }

    membershipsTouched += 1;
  }

  console.log(`Backfill complete.`);
  console.log(`  Memberships touched: ${membershipsTouched}`);
  console.log(`  Ledger entries created: ${entriesCreated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
