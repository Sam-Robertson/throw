import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MembershipStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { priceInCents, ...rest } = await request.json();

  if (priceInCents !== undefined || rest.stripePriceId !== undefined) {
    const activeCount = await prisma.membership.count({
      where: { planId: id, status: MembershipStatus.ACTIVE },
    });
    if (activeCount > 0) {
      return NextResponse.json(
        { error: "Cannot change price on a plan with active members" },
        { status: 400 }
      );
    }
  }

  const data = { ...rest, ...(priceInCents !== undefined ? { price: priceInCents } : {}) };

  const plan = await prisma.membershipPlan.update({
    where: { id },
    data,
  });

  return NextResponse.json(plan);
}
