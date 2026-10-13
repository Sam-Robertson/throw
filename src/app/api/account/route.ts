import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripeForMembership } from "@/lib/stripe";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const activeMembership = await prisma.membership.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PAUSED"] },
      stripeSubscriptionId: { not: null },
    },
    include: { plan: { select: { locationId: true } } },
  });

  if (activeMembership?.stripeSubscriptionId) {
    try {
      const account = await stripeForMembership(activeMembership);
      await account.client.subscriptions.cancel(activeMembership.stripeSubscriptionId);
    } catch (err) {
      console.error("Stripe cancel on account delete:", err);
    }
    await prisma.membership.update({
      where: { id: activeMembership.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
