import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendInngestEvent } from "@/lib/inngest";
import { grantPeriodAllowance } from "@/lib/credits";
import { ensureFreezePrice, ensureStripePriceForPlan } from "@/lib/stripePrices";
import { billingIntervalFromDays } from "@/lib/billingInterval";
import { formatMountainTime } from "@/lib/timezone";
import {
  FREEZE_MONTHS,
  canPause,
  cancelEndsAt,
  cancelReasonLabel,
  freezeTerms,
  pauseWindow,
  type FreezeTerms,
} from "@/lib/membershipLifecycle";

/**
 * Pausing, restarting and cancelling a membership, for the customer pages and
 * the admin panel alike (docs: the "My membership" design files).
 *
 * How a pause works in Stripe. The subscription is handed to a Subscription
 * Schedule with three phases: the rest of the current period on the plan
 * price, then FREEZE_MONTHS months on the freeze price ($5), then the plan
 * price again, after which the schedule releases the subscription back to
 * normal. Stripe does the phase changes itself, so nothing here has to run on
 * a timer: billing goes back to normal "automatically after 3 months".
 *
 * The webhook (api/webhooks/stripe) watches the invoices: a freeze invoice
 * flips the membership to PAUSED and adds the month's store credit ($7); the
 * first plan invoice after that flips it back to ACTIVE. The freeze phase
 * writes `throwFreeze=true` into the subscription metadata, which is how a
 * freeze invoice is recognised.
 *
 * A cancellation sets `cancel_at` on the subscription (a period end picked by
 * the 15th-of-the-month rule) and the webhook's subscription.deleted marks the
 * membership CANCELLED when Stripe ends it.
 */

export class MembershipActionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

type Actor = "customer" | "admin";

const membershipInclude = { plan: true, user: true } satisfies Prisma.MembershipInclude;
type MembershipRow = Prisma.MembershipGetPayload<{ include: typeof membershipInclude }>;

async function loadMembership(membershipId: string): Promise<MembershipRow> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: membershipInclude,
  });
  if (!membership) throw new MembershipActionError("Membership not found", 404, "NOT_FOUND");
  return membership;
}

function requireSubscriptionId(membership: MembershipRow): string {
  if (!membership.stripeSubscriptionId)
    throw new MembershipActionError("No Stripe subscription found", 400, "NO_SUBSCRIPTION");
  return membership.stripeSubscriptionId;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

/** The freeze fee and credit for a membership's studio, with the design's defaults. */
export async function freezeTermsFor(membership: {
  locationId: string | null;
  plan: { locationId: string | null };
}): Promise<FreezeTerms> {
  const locationId = membership.locationId ?? membership.plan.locationId;
  const policy = locationId
    ? await prisma.freezePolicy.findUnique({ where: { locationId } })
    : null;
  return freezeTerms(policy);
}

/** Store credit this membership has earned from being paused, in cents. */
export async function freezeCreditEarnedCents(membershipId: string): Promise<number> {
  const events = await prisma.membershipEvent.findMany({
    where: { membershipId, eventType: "CREDIT_ISSUED", metadata: { path: ["source"], equals: "freeze" } },
    select: { metadata: true },
  });
  return events.reduce((sum, e) => {
    const cents = (e.metadata as { cents?: unknown } | null)?.cents;
    return sum + (typeof cents === "number" ? cents : 0);
  }, 0);
}

/** A pause that was requested but has not reached its start date yet. */
export function isPausePending(membership: { status: string; pausedAt: Date | null }, now = new Date()): boolean {
  return membership.status === "ACTIVE" && membership.pausedAt !== null && membership.pausedAt > now;
}

/** Releases the schedule a pause attached, if there is one. The subscription keeps its current price. */
async function releaseSchedule(subscription: Stripe.Subscription): Promise<void> {
  const scheduleId = idOf(subscription.schedule);
  if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId);
}

// ── Pause ────────────────────────────────────────────────────────────────────

export interface PauseResult {
  pausedAt: Date;
  resumesAt: Date;
  terms: FreezeTerms;
}

export async function requestPause(
  membershipId: string,
  { by }: { by: Actor },
): Promise<PauseResult> {
  const membership = await loadMembership(membershipId);
  if (membership.status !== "ACTIVE")
    throw new MembershipActionError("Only an active membership can be paused", 400, "NOT_ACTIVE");
  if (membership.pausedAt)
    throw new MembershipActionError("This membership is already paused", 409, "ALREADY_PAUSED");
  if (membership.cancelAt)
    throw new MembershipActionError("This membership is already set to cancel", 409, "CANCELLING");
  if (by === "customer" && !canPause(membership.createdAt))
    throw new MembershipActionError(
      "You can pause once you've been a member for a full month",
      400,
      "TOO_SOON",
    );
  const subscriptionId = requireSubscriptionId(membership);

  const terms = await freezeTermsFor(membership);
  const freezePriceId = await ensureFreezePrice(terms.monthlyFeeCents);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.schedule)
    throw new MembershipActionError("This subscription already has a schedule", 409, "HAS_SCHEDULE");
  const item = subscription.items.data[0];
  const planPriceId = item.price.id;
  const planInterval = billingIntervalFromDays(membership.plan.billingIntervalDays);
  const currentPeriodEnd = new Date(item.current_period_end * 1000);

  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const current = schedule.phases[0];
  try {
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          start_date: current.start_date,
          end_date: current.end_date,
          items: current.items.map((i) => ({ price: idOf(i.price)!, quantity: i.quantity ?? 1 })),
        },
        {
          items: [{ price: freezePriceId, quantity: 1 }],
          duration: { interval: "month", interval_count: FREEZE_MONTHS },
          proration_behavior: "none",
          metadata: { throwFreeze: "true" },
        },
        {
          items: [{ price: planPriceId, quantity: 1 }],
          duration: { interval: planInterval.unit, interval_count: planInterval.count },
          proration_behavior: "none",
          metadata: { throwFreeze: "" },
        },
      ],
    });
  } catch (err) {
    // Leave the subscription exactly as it was rather than half-scheduled.
    await stripe.subscriptionSchedules.release(schedule.id).catch(() => {});
    throw err;
  }

  const { pausedAt, resumesAt } = pauseWindow(currentPeriodEnd);
  await prisma.membership.update({
    where: { id: membership.id },
    data: { pausedAt, resumesAt },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "PAUSED",
      note: `${by === "admin" ? "Paused by admin" : "Pause requested"}: starts ${formatMountainTime(pausedAt, "date")}, billing resumes ${formatMountainTime(resumesAt, "date")}`,
      metadata: {
        by,
        scheduleId: schedule.id,
        startsAt: pausedAt.toISOString(),
        resumesAt: resumesAt.toISOString(),
        monthlyFeeCents: terms.monthlyFeeCents,
        creditCentsPerFrozenMonth: terms.creditCentsPerFrozenMonth,
      },
    },
  });
  await sendInngestEvent({
    name: "membership/paused",
    data: { membershipId: membership.id, userId: membership.userId },
  });

  return { pausedAt, resumesAt, terms };
}

// ── Restart ──────────────────────────────────────────────────────────────────

/**
 * Restarts a paused membership now, or withdraws a pause that has not started
 * yet. Restarting mid-month bills the prorated difference between the freeze
 * fee and the plan straight away, so a $5 month can't become a free one.
 */
export async function resumeMembership(membershipId: string, { by }: { by: Actor }): Promise<void> {
  const membership = await loadMembership(membershipId);
  const paused = membership.status === "PAUSED" && membership.pausedAt !== null;
  const pending = isPausePending(membership);
  if (!paused && !pending)
    throw new MembershipActionError("This membership is not paused", 400, "NOT_PAUSED");
  const subscriptionId = requireSubscriptionId(membership);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await releaseSchedule(subscription);

  if (paused) {
    const { stripePriceId } = await ensureStripePriceForPlan(membership.planId);
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: subscription.items.data[0].id, price: stripePriceId }],
      proration_behavior: "always_invoice",
      // A paused member who had asked to cancel is choosing to stay.
      ...(subscription.cancel_at ? { cancel_at: "" } : {}),
    });
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      status: "ACTIVE",
      pausedAt: null,
      resumesAt: null,
      ...(paused ? { cancelAt: null, cancelReason: null } : {}),
    },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "RESUMED",
      note: pending
        ? `Pause withdrawn before it started${by === "admin" ? " (admin)" : ""}`
        : `Restarted${by === "admin" ? " by admin" : ""}`,
      metadata: { by },
    },
  });
  if (paused) {
    await grantPeriodAllowance(membership.id, membership.currentPeriodStart, membership.currentPeriodEnd);
  }
}

// ── Cancel ───────────────────────────────────────────────────────────────────

export interface CancelResult {
  endsAt: Date;
  /** Freeze credit taken back because the member cancelled while paused. */
  forfeitedCents: number;
}

/**
 * "If you cancel while paused, [the credit]'s gone": the store credit the
 * pause earned is taken back, down to a zero balance.
 */
async function forfeitFreezeCredit(membership: MembershipRow): Promise<number> {
  const earned = await freezeCreditEarnedCents(membership.id);
  if (earned <= 0) return 0;
  const forfeited = Math.min(earned, membership.user.accountCreditCents);
  if (forfeited <= 0) return 0;
  await prisma.user.update({
    where: { id: membership.userId },
    data: { accountCreditCents: { decrement: forfeited } },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "CREDIT_USED",
      note: "Paused-month store credit forfeited on cancellation",
      metadata: { source: "freeze-forfeit", cents: forfeited },
    },
  });
  return forfeited;
}

export async function requestCancel(
  membershipId: string,
  {
    by,
    reason = null,
    immediate = false,
    overrideCommitment = false,
  }: { by: Actor; reason?: string | null; immediate?: boolean; overrideCommitment?: boolean },
): Promise<CancelResult> {
  const membership = await loadMembership(membershipId);
  if (membership.status !== "ACTIVE" && membership.status !== "PAUSED")
    throw new MembershipActionError("No active or paused membership found", 400, "NOT_ACTIVE");
  if (membership.cancelAt && !immediate)
    throw new MembershipActionError("This membership is already set to cancel", 409, "ALREADY_CANCELLING");

  const inCommitment =
    membership.commitmentEndsAt !== null && membership.commitmentEndsAt > new Date();
  if (inCommitment && !overrideCommitment)
    throw new MembershipActionError(
      `This membership has a commitment through ${formatMountainTime(membership.commitmentEndsAt!, "date")}. It cannot be cancelled until then.`,
      400,
      "IN_COMMITMENT",
    );
  const subscriptionId = requireSubscriptionId(membership);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await releaseSchedule(subscription);

  const forfeitedCents = membership.status === "PAUSED" ? await forfeitFreezeCredit(membership) : 0;
  const reasonLabel = cancelReasonLabel(reason) ?? reason;

  if (immediate) {
    await stripe.subscriptions.cancel(subscriptionId);
    const now = new Date();
    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: "CANCELLED", cancelledAt: now, cancelAt: null, cancelReason: reason, pausedAt: null, resumesAt: null },
    });
    await prisma.membershipEvent.create({
      data: {
        membershipId: membership.id,
        eventType: "CANCELLED",
        note: [
          by === "admin" ? "Cancelled by admin" : "Cancelled",
          inCommitment ? "(commitment override)" : null,
          reasonLabel ? `— ${reasonLabel}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        metadata: {
          by,
          ...(reason ? { reason } : {}),
          ...(inCommitment ? { commitmentOverride: true } : {}),
          ...(forfeitedCents ? { forfeitedCents } : {}),
        },
      },
    });
    return { endsAt: now, forfeitedCents };
  }

  // A paused member has already stopped using the studio: their membership
  // simply ends with the paused period. An active member follows the 15th rule.
  const endsAt =
    membership.status === "PAUSED"
      ? membership.currentPeriodEnd
      : cancelEndsAt({
          now: new Date(),
          currentPeriodEnd: membership.currentPeriodEnd,
          billingIntervalDays: membership.plan.billingIntervalDays,
        });

  await stripe.subscriptions.update(subscriptionId, {
    cancel_at: Math.floor(endsAt.getTime() / 1000),
  });

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      cancelAt: endsAt,
      cancelReason: reason,
      // A pause that hadn't started yet is off: the schedule is released.
      ...(isPausePending(membership) ? { pausedAt: null, resumesAt: null } : {}),
    },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "CANCELLED",
      note: `Cancellation requested${by === "admin" ? " by admin" : ""}: ends ${formatMountainTime(endsAt, "date")}${reasonLabel ? ` — ${reasonLabel}` : ""}`,
      metadata: {
        by,
        scheduled: true,
        endsAt: endsAt.toISOString(),
        ...(reason ? { reason } : {}),
        ...(forfeitedCents ? { forfeitedCents } : {}),
      },
    },
  });

  return { endsAt, forfeitedCents };
}

/** Takes back a cancellation that has not happened yet. Active memberships only; a paused one restarts instead. */
export async function withdrawCancel(membershipId: string, { by }: { by: Actor }): Promise<void> {
  const membership = await loadMembership(membershipId);
  if (membership.status !== "ACTIVE" || !membership.cancelAt)
    throw new MembershipActionError("This membership is not set to cancel", 400, "NOT_CANCELLING");
  const subscriptionId = requireSubscriptionId(membership);

  await stripe.subscriptions.update(subscriptionId, { cancel_at: "" });
  await prisma.membership.update({
    where: { id: membership.id },
    data: { cancelAt: null, cancelReason: null },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "RESUMED",
      note: `Cancellation withdrawn${by === "admin" ? " by admin" : ""}`,
      metadata: { by },
    },
  });
}
