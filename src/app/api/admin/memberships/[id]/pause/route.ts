import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const membership = await prisma.membership.findUnique({ where: { id } });
  if (!membership)
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  if (membership.status !== "ACTIVE")
    return NextResponse.json({ error: "Membership is not active" }, { status: 400 });

  if (!membership.stripeSubscriptionId)
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });

  await stripe.subscriptions.update(membership.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  const now = new Date();
  const resumesAt = new Date(membership.currentPeriodEnd);
  resumesAt.setDate(resumesAt.getDate() + 30);

  const updated = await prisma.membership.update({
    where: { id },
    data: { pausedAt: now, resumesAt },
  });

  await prisma.membershipEvent.create({
    data: {
      membershipId: id,
      eventType: "PAUSED",
      note: `Paused by admin`,
    },
  });

  return NextResponse.json(updated);
}
