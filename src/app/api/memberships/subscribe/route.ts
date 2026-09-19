import { NextResponse } from "next/server";
import { addMonths, setDate, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPlanPurchasable } from "@/lib/membershipCatalog";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";
import { STUDIO_TIMEZONE } from "@/lib/timezone";

type CheckoutSessionCreateParams = NonNullable<
  Parameters<typeof stripe.checkout.sessions.create>[0]
>;
type LineItem = NonNullable<CheckoutSessionCreateParams["line_items"]>[number];

// Returns the unix timestamp (seconds) of the next occurrence of `day` of the
// month, at midnight America/Denver, that is strictly after now. Stripe
// requires billing_cycle_anchor to be in the future.
function nextBillingAnchorUnix(day: number): number {
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  let candidateMT = setDate(startOfDay(nowMT), day);
  if (candidateMT <= nowMT) {
    candidateMT = setDate(startOfDay(addMonths(nowMT, 1)), day);
  }
  const candidateUtc = fromZonedTime(candidateMT, STUDIO_TIMEZONE);
  return Math.floor(candidateUtc.getTime() / 1000);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { planId, commitmentTermId } = (await request.json()) as {
    planId?: string;
    commitmentTermId?: string | null;
  };

  const existing = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (existing)
    return NextResponse.json({ error: "Already a member", code: "ALREADY_MEMBER" }, { status: 409 });

  // Legacy and non-public plans are only ever assigned by staff, and a founding
  // plan stops selling once its cap group is full.
  const purchasable = await checkPlanPurchasable(
    planId ? await prisma.membershipPlan.findUnique({ where: { id: planId } }) : null,
  );
  if (!purchasable.ok)
    return NextResponse.json(
      { error: purchasable.message, code: purchasable.code },
      { status: purchasable.status },
    );
  const { plan } = purchasable;

  // The commitment term is the customer's choice on the subscribe page. With
  // none sent, month to month (months = null) is the default; if no terms are
  // set up at all, the plan's own joining fee applies as before.
  const term = commitmentTermId
    ? await prisma.commitmentTerm.findFirst({ where: { id: commitmentTermId, isActive: true } })
    : await prisma.commitmentTerm.findFirst({
        where: { months: null, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
  if (commitmentTermId && !term)
    return NextResponse.json(
      { error: "That commitment term is no longer offered", code: "TERM_NOT_FOUND" },
      { status: 400 },
    );
  const joiningFeeCents = term ? term.joiningFeeCents : plan.joiningFeeCents;

  // Stripe Prices are created here, at checkout time, with the running app's
  // own key — so production always bills against live-mode prices.
  let stripePriceId: string;
  try {
    ({ stripePriceId } = await ensureStripePriceForPlan(plan.id));
  } catch (err) {
    console.error(`[subscribe] no Stripe price for plan ${plan.slug}`, err);
    return NextResponse.json(
      { error: "Plan not configured for payments", code: "PLAN_NOT_PAYABLE" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });
    stripeCustomerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  }

  // Joining fee applies only to members who have never held a membership
  // before (any Membership row for this userId, regardless of status) — a
  // rejoining member does not pay it again.
  const priorMembershipCount = await prisma.membership.count({ where: { userId } });
  const chargeJoiningFee = joiningFeeCents > 0 && priorMembershipCount === 0;

  const lineItems: LineItem[] = [{ price: stripePriceId, quantity: 1 }];

  if (chargeJoiningFee) {
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: joiningFeeCents,
        product_data: { name: "Joining Fee" },
      },
      quantity: 1,
    });
  }

  // The webhook reads the term back from the subscription metadata to set
  // commitmentTermId and commitmentEndsAt on the new membership.
  const subscriptionMetadata: Record<string, string> = { userId, planId: plan.id };
  if (term) subscriptionMetadata.commitmentTermId = term.id;
  if (chargeJoiningFee) subscriptionMetadata.joiningFeeCharged = "true";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    customer: stripeCustomerId,
    metadata: { userId, planId: plan.id, ...(term ? { commitmentTermId: term.id } : {}) },
    subscription_data: {
      metadata: subscriptionMetadata,
      ...(plan.billingAnchorDay
        ? {
            billing_cycle_anchor: nextBillingAnchorUnix(plan.billingAnchorDay),
            proration_behavior: "create_prorations",
          }
        : {}),
    },
    success_url: process.env.NEXT_PUBLIC_APP_URL + "/membership/success",
    cancel_url: process.env.NEXT_PUBLIC_APP_URL + "/membership",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
