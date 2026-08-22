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

  if (membership.status !== "ACTIVE" && membership.status !== "PAUSED")
    return NextResponse.json(
      { error: "Membership is not active or paused" },
      { status: 400 },
    );

  if (!membership.stripeSubscriptionId)
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 400 });

  const isCommitmentOverride =
    membership.commitmentEndsAt !== null && membership.commitmentEndsAt > new Date();

  await stripe.subscriptions.cancel(membership.stripeSubscriptionId);

  const updated = await prisma.membership.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await prisma.membershipEvent.create({
    data: {
      membershipId: id,
      eventType: "CANCELLED",
      note: isCommitmentOverride ? "Cancelled by admin (commitment override)" : "Cancelled by admin",
      ...(isCommitmentOverride && { metadata: { commitmentOverride: true } }),
    },
  });

  return NextResponse.json(updated);
}
