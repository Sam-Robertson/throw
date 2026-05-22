import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plans = await prisma.membershipPlan.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } },
  });

  return NextResponse.json(plans);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, description, priceInCents, billingIntervalDays, stripePriceId, locationId } =
    await request.json();

  const plan = await prisma.membershipPlan.create({
    data: { name, slug, description, price: priceInCents, billingIntervalDays, stripePriceId, locationId },
  });

  return NextResponse.json(plan, { status: 201 });
}
