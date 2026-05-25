import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

const TZ = "America/Denver";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const nowMT = toZonedTime(now, TZ);
  const todayStartUTC = fromZonedTime(startOfDay(nowMT), TZ);
  const todayEndUTC = fromZonedTime(endOfDay(nowMT), TZ);
  const ystStartUTC = fromZonedTime(startOfDay(subDays(nowMT, 1)), TZ);
  const ystEndUTC = fromZonedTime(endOfDay(subDays(nowMT, 1)), TZ);
  const sevenDaysAgoUTC = fromZonedTime(startOfDay(subDays(nowMT, 6)), TZ);
  const sevenDaysAgo = subDays(now, 7);

  const [
    revToday,
    revYesterday,
    activeMembers,
    bookingsToday,
    openTasks,
    todaysSessions,
    pendingTasks,
    recentBookings,
    recentMemberships,
    recentPayments,
    membershipCounts,
    activeMembershipsForMRR,
    revLast7,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", createdAt: { gte: todayStartUTC, lte: todayEndUTC } },
      _sum: { amountInCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", createdAt: { gte: ystStartUTC, lte: ystEndUTC } },
      _sum: { amountInCents: true },
    }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.booking.count({
      where: {
        status: "CONFIRMED",
        studioSession: { startsAt: { gte: todayStartUTC, lte: todayEndUTC } },
      },
    }),
    prisma.staffTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.studioSession.findMany({
      where: { startsAt: { gte: todayStartUTC, lte: todayEndUTC }, isCancelled: false },
      include: {
        sessionType: { select: { name: true } },
        instructor: { select: { name: true } },
        location: { select: { name: true } },
        bookings: {
          where: { status: { in: ["CONFIRMED", "WAITLIST"] } },
          select: { status: true, amountPaidCents: true, source: true },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.staffTask.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: {
        assignedTo: { select: { name: true, email: true } },
        linkedCustomer: { select: { name: true, email: true } },
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", createdAt: { gte: sevenDaysAgo } },
      include: {
        user: { select: { name: true, email: true } },
        studioSession: { select: { sessionType: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.membership.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.payment.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: sevenDaysAgo } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.membership.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.membership.findMany({
      where: { status: "ACTIVE" },
      select: { plan: { select: { price: true, billingIntervalDays: true } } },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: sevenDaysAgoUTC, lte: todayEndUTC } },
      select: { amountInCents: true, createdAt: true },
    }),
  ]);

  // MRR
  const mrr = Math.round(
    activeMembershipsForMRR.reduce(
      (sum, m) => sum + m.plan.price * (30 / m.plan.billingIntervalDays),
      0
    )
  );

  // Membership status snapshot
  const snap: Record<string, number> = {};
  for (const row of membershipCounts) snap[row.status] = row._count.id;

  // Revenue sparkline — last 7 days
  const dayRevMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    dayRevMap[format(toZonedTime(subDays(now, i), TZ), "MMM d")] = 0;
  }
  for (const p of revLast7) {
    const k = format(toZonedTime(p.createdAt, TZ), "MMM d");
    if (k in dayRevMap) dayRevMap[k] += p.amountInCents;
  }
  const sparkline = Object.entries(dayRevMap).map(([date, value]) => ({ date, value }));

  // Activity feed (merge + sort)
  type Activity = {
    id: string;
    type: "booking" | "membership" | "payment";
    description: string;
    userName: string | null;
    userEmail: string;
    createdAt: string;
  };
  const activities: Activity[] = [
    ...recentBookings.map((b) => ({
      id: `b-${b.id}`,
      type: "booking" as const,
      description: `Booked ${b.studioSession.sessionType.name}`,
      userName: b.user.name,
      userEmail: b.user.email,
      createdAt: b.createdAt.toISOString(),
    })),
    ...recentMemberships.map((m) => ({
      id: `m-${m.id}`,
      type: "membership" as const,
      description: `Joined ${m.plan.name}`,
      userName: m.user.name,
      userEmail: m.user.email,
      createdAt: m.createdAt.toISOString(),
    })),
    ...recentPayments.map((p) => ({
      id: `p-${p.id}`,
      type: "payment" as const,
      description: `Paid $${(p.amountInCents / 100).toFixed(2)}`,
      userName: p.user.name,
      userEmail: p.user.email,
      createdAt: p.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Normalize sessions
  const sessions = todaysSessions.map((s) => {
    const confirmed = s.bookings.filter((b) => b.status === "CONFIRMED");
    const waitlist = s.bookings.filter((b) => b.status === "WAITLIST");
    const unpaid = confirmed.filter(
      (b) => b.source === "DROP_IN" && b.amountPaidCents === 0
    );
    return {
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      sessionType: { name: s.sessionType.name },
      instructor: s.instructor ? { name: s.instructor.name } : null,
      location: s.location ? { name: s.location.name } : null,
      capacity: s.capacity,
      confirmedCount: confirmed.length,
      waitlistCount: waitlist.length,
      unpaidCount: unpaid.length,
    };
  });

  return NextResponse.json({
    user: { name: session.user.name ?? null, email: session.user.email! },
    stats: {
      revenueToday: revToday._sum.amountInCents ?? 0,
      revenueYesterday: revYesterday._sum.amountInCents ?? 0,
      activeMembers,
      bookingsToday,
      openTasks,
      sparkline,
    },
    todaysSessions: sessions,
    tasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.dueAt?.toISOString() ?? null,
      assignedTo: t.assignedTo,
      linkedCustomer: t.linkedCustomer,
    })),
    recentActivity: activities,
    membershipSnapshot: {
      active: snap.ACTIVE ?? 0,
      paused: snap.PAUSED ?? 0,
      cancelled: snap.CANCELLED ?? 0,
      expired: snap.EXPIRED ?? 0,
      mrr,
    },
  });
}
