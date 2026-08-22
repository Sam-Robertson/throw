import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTicketBalance } from "@/lib/credits";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { delta?: number; note?: string } | null;
  if (!body?.delta || body.delta === 0) {
    return NextResponse.json({ error: "delta is required and cannot be zero" }, { status: 400 });
  }
  if (!body.note?.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({ where: { id }, include: { plan: true } });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }
  if (membership.plan.classTicketsPerPeriod === null) {
    return NextResponse.json(
      { error: "This plan is unlimited and does not track tickets" },
      { status: 400 },
    );
  }

  await prisma.membershipCreditLedger.create({
    data: {
      membershipId: id,
      type: "ADJUSTMENT",
      delta: Math.trunc(body.delta),
      periodStart: membership.currentPeriodStart,
      periodEnd: membership.currentPeriodEnd,
      note: body.note.trim(),
      createdById: session.user.id,
    },
  });

  const balance = await getTicketBalance(id);

  return NextResponse.json(balance);
}
