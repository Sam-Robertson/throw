import { addDays } from "date-fns";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextBillingAnchor } from "@/lib/billingAnchor";
import { billingPeriodLabel } from "@/lib/billingInterval";
import { createMembershipFromSubscription } from "@/lib/membershipCreate";
import { checkPlanPurchasable } from "@/lib/membershipCatalog";
import { stripeAccountForStudio, type StripeAccount } from "@/lib/stripeAccounts";
import { ensureStripeCustomerId } from "@/lib/stripeCustomers";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";
import { formatMountainTime } from "@/lib/timezone";
import { findUnsignedWaiver } from "@/lib/waivers";

/**
 * Memberships sold at the register (since 2026-10-14; before that they were
 * online only).
 *
 * How it works: the MEMBERSHIP line charges the first period (plus the joining
 * fee for a first-ever member) like any other sale, through the studio's own
 * Stripe account. When the order completes, a Stripe subscription is created
 * for the customer in that same account with a trial running to the end of
 * the period they just paid for, so Stripe bills nothing today and renews
 * from the next period on. A card paid through the reader or typed in is
 * saved to the customer (setup_future_usage on the PaymentIntent) and becomes
 * the subscription's payment method; an order paid some other way (gift
 * card, credit, comp) starts the subscription with no card, and the note on
 * the order says a card is needed before renewal.
 *
 * The Membership row, its first ticket allowance and the welcome text are
 * created right away (createMembershipFromSubscription); the webhook's
 * customer.subscription.created finds it and does nothing more.
 */

export const POS_MEMBERSHIP_KIND = "MEMBERSHIP_START";

/** The earliest a desk-sold anchor-day plan renews, so a member joining on the 28th isn't billed again on the 1st. */
const MIN_FIRST_PERIOD_DAYS = 15;

export interface MembershipLineMetadata {
  kind: typeof POS_MEMBERSHIP_KIND;
  planId: string;
  commitmentTermId: string | null;
  joiningFeeCents: number;
  periodCents: number;
  /** ISO date the paid period runs to; the subscription's trial ends then. */
  paidThrough: string;
  stripeSubscriptionId?: string;
}

function periodEndFor(plan: { billingIntervalDays: number; billingAnchorDay: number | null }, from: Date): Date {
  const byInterval = addDays(from, plan.billingIntervalDays);
  if (!plan.billingAnchorDay) return byInterval;
  // Bill-on-the-1st plans: the first renewal lands on the anchor day, but
  // never within a couple of weeks of paying a full period at the desk.
  const earliest = addDays(from, MIN_FIRST_PERIOD_DAYS);
  return nextBillingAnchor(plan.billingAnchorDay, earliest);
}

export type MembershipLineProblem = { status: 400 | 403 | 404 | 409; error: string; message: string };

export type MembershipLine = {
  name: string;
  unitPriceCents: number;
  metadata: MembershipLineMetadata;
};

/**
 * Works out the MEMBERSHIP line for `planId` sold to `customerId` at
 * `locationId`, or why it can't be sold: the same rules as online
 * (purchasable plan, not already a member, membership waiver signed) plus
 * the studio match.
 */
export async function describeMembershipLine(input: {
  planId: string;
  commitmentTermId?: string | null;
  customerId: string | null;
  locationId: string;
}): Promise<MembershipLine | MembershipLineProblem> {
  if (!input.customerId) {
    return {
      status: 400,
      error: "CUSTOMER_REQUIRED",
      message: "A membership goes on a customer's account. Attach the customer first.",
    };
  }

  const purchasable = await checkPlanPurchasable(
    await prisma.membershipPlan.findUnique({ where: { id: input.planId } }),
  );
  if (!purchasable.ok) {
    return { status: purchasable.status as 403 | 404 | 409, error: purchasable.code, message: purchasable.message };
  }
  const { plan } = purchasable;
  if (plan.price <= 0) {
    return { status: 409, error: "PLAN_NOT_PRICED", message: `${plan.name} has no price yet.` };
  }
  if (plan.locationId && plan.locationId !== input.locationId) {
    return { status: 400, error: "WRONG_LOCATION", message: "That plan belongs to a different studio." };
  }

  const current = await prisma.membership.findFirst({
    where: { userId: input.customerId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { plan: { select: { name: true } } },
  });
  if (current) {
    return {
      status: 409,
      error: "ALREADY_MEMBER",
      message: `This customer already has a membership (${current.plan.name}). Change their plan from their customer page instead.`,
    };
  }

  const unsignedWaiver = await findUnsignedWaiver(input.customerId, plan.locationId ?? input.locationId, "MEMBERSHIP", {
    planId: plan.id,
  });
  if (unsignedWaiver) {
    return {
      status: 409,
      error: "WAIVER_REQUIRED",
      message: `This customer hasn't signed the ${unsignedWaiver.name}. Send them the membership waiver (Send waiver link) and add the membership once it's signed.`,
    };
  }

  // The commitment term is the customer's choice; month to month is the
  // default, and with no terms set up the plan's own joining fee applies.
  const term = input.commitmentTermId
    ? await prisma.commitmentTerm.findFirst({ where: { id: input.commitmentTermId, isActive: true } })
    : await prisma.commitmentTerm.findFirst({ where: { months: null, isActive: true }, orderBy: { sortOrder: "asc" } });
  if (input.commitmentTermId && !term) {
    return { status: 400, error: "TERM_NOT_FOUND", message: "That commitment term is no longer offered." };
  }

  // Joining fee: only for someone who has never held a membership.
  const priorMembershipCount = await prisma.membership.count({ where: { userId: input.customerId } });
  const feeCents = term ? term.joiningFeeCents : plan.joiningFeeCents;
  const joiningFeeCents = priorMembershipCount === 0 ? feeCents : 0;

  const paidThrough = periodEndFor(plan, new Date());
  const periodLabel = billingPeriodLabel(plan.billingIntervalDays);
  const name = [
    `${plan.name} membership`,
    term ? term.name : null,
    `first ${periodLabel}${joiningFeeCents > 0 ? " + joining fee" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    name,
    unitPriceCents: plan.price + joiningFeeCents,
    metadata: {
      kind: POS_MEMBERSHIP_KIND,
      planId: plan.id,
      commitmentTermId: term?.id ?? null,
      joiningFeeCents,
      periodCents: plan.price,
      paidThrough: paidThrough.toISOString(),
    },
  };
}

export function membershipLineMetadata(value: Prisma.JsonValue | null | undefined): MembershipLineMetadata | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.kind !== POS_MEMBERSHIP_KIND || typeof m.planId !== "string" || typeof m.paidThrough !== "string") return null;
  return {
    kind: POS_MEMBERSHIP_KIND,
    planId: m.planId,
    commitmentTermId: typeof m.commitmentTermId === "string" ? m.commitmentTermId : null,
    joiningFeeCents: typeof m.joiningFeeCents === "number" ? m.joiningFeeCents : 0,
    periodCents: typeof m.periodCents === "number" ? m.periodCents : 0,
    paidThrough: m.paidThrough,
    stripeSubscriptionId: typeof m.stripeSubscriptionId === "string" ? m.stripeSubscriptionId : undefined,
  };
}

/** True when the order sells a membership, so card tenders should save the card. */
export function orderSellsMembership(items: { itemType: string }[]): boolean {
  return items.some((i) => i.itemType === "MEMBERSHIP");
}

/**
 * The reusable card behind a successful card payment, if the PaymentIntent
 * was created with setup_future_usage: a typed-in card's PaymentMethod, or
 * the card the reader generated from a card-present payment.
 */
async function savedCardFromPayment(account: StripeAccount, paymentIntentId: string): Promise<string | null> {
  try {
    const intent = await account.client.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | null;
    const generated = charge?.payment_method_details?.card_present?.generated_card;
    if (generated) return generated;
    if (intent.setup_future_usage && typeof intent.payment_method === "string") {
      const pm = await account.client.paymentMethods.retrieve(intent.payment_method);
      if (pm.type === "card" && pm.customer) return pm.id;
    }
    return null;
  } catch (err) {
    console.error(`[pos] could not read the saved card from ${paymentIntentId}:`, err);
    return null;
  }
}

type CompletedOrder = Prisma.PosOrderGetPayload<{
  include: { items: true; payments: true; location: { select: { name: true } } };
}>;

/**
 * Starts the subscription for each MEMBERSHIP line of a completed order.
 * Runs after the money is taken, so it never throws: a failure is written on
 * the order for staff and logged. Returns notes for the order.
 */
export async function startPosMemberships(order: CompletedOrder): Promise<string[]> {
  const notes: string[] = [];
  const lines = order.items.filter((i) => i.itemType === "MEMBERSHIP");
  if (lines.length === 0) return notes;

  if (!order.customerId) {
    notes.push("No membership started: the order has no customer.");
    return notes;
  }

  const account = stripeAccountForStudio(order.location.name);

  // Whichever card tender succeeded first saved the card (see the card routes).
  let savedCard: string | null = null;
  for (const payment of order.payments) {
    if (payment.status !== "SUCCEEDED" || !payment.stripePaymentIntentId) continue;
    savedCard = await savedCardFromPayment(account, payment.stripePaymentIntentId);
    if (savedCard) break;
  }

  for (const item of lines) {
    const meta = membershipLineMetadata(item.metadata);
    if (!meta) {
      notes.push(`No membership started for ${item.name}: the line is missing its plan.`);
      continue;
    }
    if (meta.stripeSubscriptionId) continue; // already done (a retried completion)

    try {
      const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: meta.planId } });
      const { stripePriceId } = await ensureStripePriceForPlan(plan.id, account);
      const stripeCustomerId = await ensureStripeCustomerId(account, order.customerId);
      const paidThrough = new Date(meta.paidThrough);

      const metadata: Record<string, string> = {
        userId: order.customerId,
        planId: plan.id,
        source: "pos",
        posOrderId: order.id,
      };
      if (meta.commitmentTermId) metadata.commitmentTermId = meta.commitmentTermId;
      if (meta.joiningFeeCents > 0) metadata.joiningFeeCharged = "true";

      const subscription = await account.client.subscriptions.create(
        {
          customer: stripeCustomerId,
          items: [{ price: stripePriceId }],
          // The period paid at the desk is a trial to Stripe: nothing is
          // billed today, and the first invoice lands when it ends.
          trial_end: Math.floor(paidThrough.getTime() / 1000),
          proration_behavior: "none",
          ...(savedCard ? { default_payment_method: savedCard } : {}),
          metadata,
        },
        { idempotencyKey: `pos_membership_${item.id}` },
      );

      await prisma.posOrderItem.update({
        where: { id: item.id },
        data: { metadata: { ...meta, stripeSubscriptionId: subscription.id } },
      });

      await createMembershipFromSubscription(subscription);

      const through = formatMountainTime(paidThrough, "date");
      notes.push(
        savedCard
          ? `${plan.name} membership started, paid through ${through}. It renews on the card used today.`
          : `${plan.name} membership started, paid through ${through}. No card was saved (not paid by card), so a card must be added in Stripe before it renews.`,
      );
    } catch (err) {
      console.error(`[pos] order ${order.id}: failed to start the membership on line ${item.id}:`, err);
      notes.push(
        `The membership for ${item.name} could not be started in Stripe. The customer has paid: set it up from their customer page, or refund the order.`,
      );
    }
  }

  return notes;
}
