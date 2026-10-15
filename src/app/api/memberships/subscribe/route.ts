import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPlanPurchasable } from "@/lib/membershipCatalog";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";
import { ensureStripeCustomerId } from "@/lib/stripeCustomers";
import { nextBillingAnchorUnix } from "@/lib/billingAnchor";
import { findUnsignedWaiver } from "@/lib/waivers";

type CheckoutSessionCreateParams = NonNullable<
  Parameters<Stripe["checkout"]["sessions"]["create"]>[0]
>;
type LineItem = NonNullable<CheckoutSessionCreateParams["line_items"]>[number];

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

  const unsignedWaiver = await findUnsignedWaiver(userId, plan.locationId, "MEMBERSHIP", { planId: plan.id });
  if (unsignedWaiver)
    return NextResponse.json(
      {
        error: `Please sign the ${unsignedWaiver.name} before starting a membership.`,
        code: "WAIVER_REQUIRED",
        waiverVersionId: unsignedWaiver.id,
      },
      { status: 403 },
    );

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

  // Stripe Prices are created here, at checkout time, in the plan's studio's
  // own Stripe account with the running app's key — so production always
  // bills against live-mode prices, and a Lehi plan bills into Lehi's account.
  let stripePriceId: string;
  let account: Awaited<ReturnType<typeof ensureStripePriceForPlan>>["account"];
  try {
    ({ stripePriceId, account } = await ensureStripePriceForPlan(plan.id));
  } catch (err) {
    console.error(`[subscribe] no Stripe price for plan ${plan.slug}`, err);
    return NextResponse.json(
      { error: "Plan not configured for payments", code: "PLAN_NOT_PAYABLE" },
      { status: 400 },
    );
  }

  // The customer has to exist in the same account as the price.
  const stripeCustomerId = await ensureStripeCustomerId(account, userId);

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

  const checkoutSession = await account.client.checkout.sessions.create({
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
