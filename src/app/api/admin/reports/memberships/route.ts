import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // STAFF must have canViewMembershipReporting
  if (session.user.role === "STAFF") {
    const allowed = await checkPermission(session.user.id, "canViewMembershipReporting");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const def = defaultRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;

  const [
    activeCount,
    pausedCount,
    expiredCount,
    newCount,
    cancelledCount,
    activeMemberships,
    events,
  ] = await Promise.all([
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.membership.count({ where: { status: "PAUSED" } }),
    prisma.membership.count({ where: { status: "EXPIRED" } }),
    prisma.membership.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.membership.count({
      where: { status: "CANCELLED", cancelledAt: { gte: from, lte: to } },
    }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      include: {
        plan: { select: { price: true, billingIntervalDays: true, name: true, id: true } },
      },
    }),
    prisma.membershipEvent.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        membership: {
          include: {
            user: { select: { name: true, email: true } },
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // MRR: normalize each active membership to monthly
  const mrrCents = Math.round(
    activeMemberships.reduce((sum, m) => {
      const intervalDays = m.plan.billingIntervalDays || 30;
      // normalize to 30-day month
      const monthly = (m.plan.price * 30) / intervalDays;
      return sum + monthly;
    }, 0),
  );

  // By-plan breakdown
  const byPlanMap: Record<string, { name: string; count: number }> = {};
  for (const m of activeMemberships) {
    const key = m.plan.id;
    if (!byPlanMap[key]) byPlanMap[key] = { name: m.plan.name, count: 0 };
    byPlanMap[key].count++;
  }
  const byPlan = Object.values(byPlanMap).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    summary: {
      activeCount,
      pausedCount,
      expiredCount,
      newCount,
      cancelledCount,
      mrrCents,
    },
    byPlan,
    events: events.map((e) => ({
      id: e.id,
      date: e.createdAt,
      customerName: e.membership.user.name ?? e.membership.user.email,
      eventType: e.eventType,
      planName: e.membership.plan.name,
      note: e.note,
    })),
  });
}
