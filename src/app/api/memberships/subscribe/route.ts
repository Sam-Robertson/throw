import { NextResponse } from "next/server";
import { addMonths, setDate, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
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
  const { planId } = await request.json();

  const existing = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (existing)
    return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (!plan.stripePriceId)
    return NextResponse.json({ error: "Plan not configured for payments" }, { status: 400 });

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
  const chargeJoiningFee = plan.joiningFeeCents > 0 && priorMembershipCount === 0;

  const lineItems: LineItem[] = [{ price: plan.stripePriceId, quantity: 1 }];

  if (chargeJoiningFee) {
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: plan.joiningFeeCents,
        product_data: { name: "Joining Fee" },
      },
      quantity: 1,
    });
  }

  const subscriptionMetadata: Record<string, string> = { userId, planId };
  if (chargeJoiningFee) subscriptionMetadata.joiningFeeCharged = "true";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    customer: stripeCustomerId,
    metadata: { userId, planId },
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
