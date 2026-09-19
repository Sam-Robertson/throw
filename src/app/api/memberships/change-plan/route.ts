import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkPlanPurchasable } from "@/lib/membershipCatalog";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { newPlanId } = await request.json();

  if (!newPlanId)
    return NextResponse.json({ error: "newPlanId is required" }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { plan: true },
  });

  if (!membership)
    return NextResponse.json({ error: "No active membership found" }, { status: 404 });

  if (!membership.stripeSubscriptionId)
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });

  // A switch target has to be buyable online: never a legacy or private plan,
  // and a founding plan only while its cap has room.
  const check = await checkPlanPurchasable(
    await prisma.membershipPlan.findUnique({ where: { id: newPlanId } }),
  );
  if (!check.ok)
    return NextResponse.json({ error: check.code, message: check.message }, { status: check.status });
  const newPlan = check.plan;

  let newPriceId: string;
  try {
    newPriceId = (await ensureStripePriceForPlan(newPlan.id)).stripePriceId;
  } catch {
    return NextResponse.json({ error: "New plan not configured for payments" }, { status: 400 });
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    membership.stripeSubscriptionId,
  );

  await stripe.subscriptions.update(membership.stripeSubscriptionId, {
    items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: "create_prorations",
  });

  const eventType = newPlan.price > membership.plan.price ? "UPGRADED" : "DOWNGRADED";

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { planId: newPlanId },
  });

  await prisma.membershipEvent.create({
    data: { membershipId: membership.id, eventType },
  });

  return NextResponse.json(updated);
}
