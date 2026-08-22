import { prisma } from "@/lib/prisma";

// type vocabulary, enforced in code (see MembershipCreditLedger in schema.prisma):
//   ALLOWANCE  granted at the start of a billing period, positive
//   ROLLOVER   carried from the prior period, positive
//   BOOKING    consumed by a booking, negative
//   REFUND     returned when a booking is cancelled, positive
//   ADJUSTMENT manual grant or deduction by an admin, either sign
//   EXPIRY     zeroing out unused tickets at period end, negative
export type LedgerEntryType =
  | "ALLOWANCE"
  | "ROLLOVER"
  | "BOOKING"
  | "REFUND"
  | "ADJUSTMENT"
  | "EXPIRY";

export interface TicketBalance {
  balance: number | null; // null when the plan is unlimited — check `unlimited` first
  unlimited: boolean;
  allowance: number;
  used: number;
  periodStart: Date;
  periodEnd: Date;
}

export async function getTicketBalance(membershipId: string): Promise<TicketBalance> {
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { plan: true },
  });

  const periodStart = membership.currentPeriodStart;
  const periodEnd = membership.currentPeriodEnd;

  if (membership.plan.classTicketsPerPeriod === null) {
    return { balance: null, unlimited: true, allowance: 0, used: 0, periodStart, periodEnd };
  }

  // Balance is the sum of every delta ever recorded — never a stored running
  // total. Past periods' leftovers are always neutralized (EXPIRY, or
  // EXPIRY+ROLLOVER) by the time the next period starts, so summing
  // unrestricted here is equivalent to summing just the current period and
  // avoids relying on period-boundary filtering for the number that matters.
  const allEntries = await prisma.membershipCreditLedger.findMany({ where: { membershipId } });
  const balance = allEntries.reduce((sum, e) => sum + e.delta, 0);

  const periodEntries = allEntries.filter(
    (e) => e.periodStart.getTime() === periodStart.getTime(),
  );
  const allowance = periodEntries
    .filter((e) => e.type === "ALLOWANCE" || e.type === "ROLLOVER")
    .reduce((sum, e) => sum + e.delta, 0);
  const bookingSum = periodEntries
    .filter((e) => e.type === "BOOKING")
    .reduce((sum, e) => sum + e.delta, 0);
  const refundSum = periodEntries
    .filter((e) => e.type === "REFUND")
    .reduce((sum, e) => sum + e.delta, 0);
  const used = Math.max(0, -bookingSum - refundSum);

  return { balance, unlimited: false, allowance, used, periodStart, periodEnd };
}

export async function grantPeriodAllowance(
  membershipId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { plan: true },
  });

  if (membership.plan.classTicketsPerPeriod === null) return; // unlimited plans don't use the ledger

  await prisma.$transaction(async (tx) => {
    // Row lock so customer.subscription.created and the first
    // invoice.payment_succeeded — which can fire near-simultaneously for the
    // same period on signup — can't both pass the idempotency check below
    // before either commits its ALLOWANCE entry.
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE id = ${membershipId} FOR UPDATE`;

    const existing = await tx.membershipCreditLedger.findFirst({
      where: { membershipId, type: "ALLOWANCE", periodStart },
    });
    if (existing) return; // idempotent no-op

    // Neutralize whatever's left from the prior period exactly once, then
    // (if rollover is enabled) re-grant a capped amount as ROLLOVER. This
    // keeps "balance = sum of deltas" honest instead of double-counting the
    // prior remainder.
    const priorEntries = await tx.membershipCreditLedger.findMany({ where: { membershipId } });
    const priorUnused = priorEntries.reduce((sum, e) => sum + e.delta, 0);

    if (priorUnused > 0) {
      await tx.membershipCreditLedger.create({
        data: {
          membershipId,
          type: "EXPIRY",
          delta: -priorUnused,
          periodStart,
          periodEnd,
          note: membership.plan.ticketRolloverEnabled
            ? "Prior period balance cleared before rollover"
            : "Unused tickets expired at period end",
        },
      });

      if (membership.plan.ticketRolloverEnabled) {
        const cap = membership.plan.ticketRolloverMaxTickets;
        const rolloverAmount = cap !== null ? Math.min(priorUnused, cap) : priorUnused;
        if (rolloverAmount > 0) {
          await tx.membershipCreditLedger.create({
            data: {
              membershipId,
              type: "ROLLOVER",
              delta: rolloverAmount,
              periodStart,
              periodEnd,
              note:
                cap !== null && priorUnused > cap
                  ? `Capped from ${priorUnused} unused tickets`
                  : undefined,
            },
          });
        }
      }
    }

    await tx.membershipCreditLedger.create({
      data: {
        membershipId,
        type: "ALLOWANCE",
        delta: membership.plan.classTicketsPerPeriod!,
        periodStart,
        periodEnd,
      },
    });
  });
}

export async function consumeTicket(
  membershipId: string,
  bookingId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ ok: true } | { ok: false; reason: "INSUFFICIENT_BALANCE" }> {
  return prisma.$transaction(async (tx) => {
    // Row lock so two simultaneous bookings against the last ticket can't
    // both read the same balance before either commits its BOOKING entry.
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE id = ${membershipId} FOR UPDATE`;

    const entries = await tx.membershipCreditLedger.findMany({ where: { membershipId } });
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);

    if (balance <= 0) {
      return { ok: false as const, reason: "INSUFFICIENT_BALANCE" as const };
    }

    await tx.membershipCreditLedger.create({
      data: {
        membershipId,
        type: "BOOKING",
        delta: -1,
        bookingId,
        periodStart,
        periodEnd,
      },
    });

    return { ok: true as const };
  });
}

export async function refundTicket(membershipId: string, bookingId: string): Promise<void> {
  const existingRefund = await prisma.membershipCreditLedger.findFirst({
    where: { membershipId, type: "REFUND", bookingId },
  });
  if (existingRefund) return; // idempotent no-op

  const bookingEntry = await prisma.membershipCreditLedger.findFirst({
    where: { membershipId, type: "BOOKING", bookingId },
  });
  if (!bookingEntry) return; // this booking never consumed a ticket

  await prisma.membershipCreditLedger.create({
    data: {
      membershipId,
      type: "REFUND",
      delta: 1,
      bookingId,
      periodStart: bookingEntry.periodStart,
      periodEnd: bookingEntry.periodEnd,
    },
  });
}
