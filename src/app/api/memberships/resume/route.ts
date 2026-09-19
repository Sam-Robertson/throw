import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const membership = await prisma.membership.findFirst({
    where: { userId, status: "PAUSED" },
    include: { plan: true },
  });

  if (!membership)
    return NextResponse.json({ error: "No paused membership found" }, { status: 404 });

  // Resuming keeps the member on their own plan, legacy or not, so this only
  // needs a current Stripe Price for it.
  let stripePriceId: string;
  try {
    stripePriceId = (await ensureStripePriceForPlan(membership.planId)).stripePriceId;
  } catch {
    return NextResponse.json({ error: "Plan not configured for payments" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.stripeCustomerId)
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 });

  const subscription = await stripe.subscriptions.create({
    customer: user.stripeCustomerId,
    items: [{ price: stripePriceId }],
    metadata: { userId, planId: membership.planId },
  });

  const item = subscription.items.data[0];

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: {
      status: "ACTIVE",
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      pausedAt: null,
      resumesAt: null,
    },
  });

  await prisma.membershipEvent.create({
    data: { membershipId: membership.id, eventType: "RESUMED" },
  });

  return NextResponse.json(updated);
}
