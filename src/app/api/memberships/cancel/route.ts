import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { formatMountainTime } from "@/lib/timezone";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const membership = await prisma.membership.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
  });

  if (!membership)
    return NextResponse.json({ error: "No active or paused membership found" }, { status: 404 });

  if (membership.commitmentEndsAt && membership.commitmentEndsAt > new Date()) {
    return NextResponse.json(
      {
        error: `This membership has a commitment through ${formatMountainTime(membership.commitmentEndsAt, "date")}. It cannot be cancelled until then.`,
      },
      { status: 400 },
    );
  }

  if (!membership.stripeSubscriptionId)
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });

  await stripe.subscriptions.cancel(membership.stripeSubscriptionId);

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await prisma.membershipEvent.create({
    data: { membershipId: membership.id, eventType: "CANCELLED" },
  });

  return NextResponse.json(updated);
}
