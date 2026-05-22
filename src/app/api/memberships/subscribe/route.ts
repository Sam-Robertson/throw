import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    customer: stripeCustomerId,
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId } },
    success_url: process.env.NEXT_PUBLIC_APP_URL + "/membership/success",
    cancel_url: process.env.NEXT_PUBLIC_APP_URL + "/membership",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
