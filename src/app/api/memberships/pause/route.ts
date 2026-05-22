import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { inngest } from "@/lib/inngest";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const membership = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
  });

  if (!membership)
    return NextResponse.json({ error: "No active membership found" }, { status: 404 });

  if (!membership.stripeSubscriptionId)
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });

  await stripe.subscriptions.update(membership.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  const now = new Date();
  const resumesAt = new Date(membership.currentPeriodEnd);
  resumesAt.setDate(resumesAt.getDate() + 30);

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { pausedAt: now, resumesAt },
  });

  await prisma.membershipEvent.create({
    data: { membershipId: membership.id, eventType: "PAUSED" },
  });

  await inngest.send({
    name: "membership/paused",
    data: { membershipId: membership.id, userId },
  });

  return NextResponse.json(updated);
}
