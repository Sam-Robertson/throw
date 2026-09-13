import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";

const TZ = "America/Denver";

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const def = defaultRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;

  const [
    totalRevenueResult,
    dropInRevenueResult,
    membershipRevenueResult,
    newMembersCount,
    activeMembersCount,
    totalBookings,
    cancellations,
    allPayments,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", createdAt: { gte: from, lte: to } },
      _sum: { amountInCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", type: "DROP_IN", createdAt: { gte: from, lte: to } },
      _sum: { amountInCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", type: "MEMBERSHIP", createdAt: { gte: from, lte: to } },
      _sum: { amountInCents: true },
    }),
    prisma.membership.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    prisma.membership.count({
      where: { status: "ACTIVE" },
    }),
    prisma.booking.count({
      where: {
        status: { in: ["CONFIRMED", "NO_SHOW"] },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.booking.count({
      where: { status: "CANCELLED", createdAt: { gte: from, lte: to } },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: from, lte: to } },
      select: { amountInCents: true, createdAt: true, type: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build revenue-by-day array (all days in range), split by revenue source
  // so the chart can stack drop-in vs. membership vs. everything else
  // (tips, gift cards, comps) rather than showing one opaque total.
  type DayBucket = { dropInCents: number; membershipCents: number; otherCents: number };
  const dayMap: Record<string, DayBucket> = {};
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = formatInTimeZone(cursor, TZ, "yyyy-MM-dd");
    dayMap[key] = { dropInCents: 0, membershipCents: 0, otherCents: 0 };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const p of allPayments) {
    const key = formatInTimeZone(p.createdAt, TZ, "yyyy-MM-dd");
    const bucket = dayMap[key];
    if (!bucket) continue;
    if (p.type === "DROP_IN") bucket.dropInCents += p.amountInCents;
    else if (p.type === "MEMBERSHIP") bucket.membershipCents += p.amountInCents;
    else bucket.otherCents += p.amountInCents;
  }
  const revenueByDay = Object.entries(dayMap).map(([date, bucket]) => ({ date, ...bucket }));

  const totalRevenue = totalRevenueResult._sum.amountInCents ?? 0;
  const avgBookingsPerMember =
    activeMembersCount > 0 ? totalBookings / activeMembersCount : 0;

  return NextResponse.json({
    totalRevenue,
    dropInRevenue: dropInRevenueResult._sum.amountInCents ?? 0,
    membershipRevenue: membershipRevenueResult._sum.amountInCents ?? 0,
    newMembers: newMembersCount,
    activeMembers: activeMembersCount,
    totalBookings,
    cancellations,
    avgBookingsPerMember: Math.round(avgBookingsPerMember * 10) / 10,
    revenueByDay,
  });
}
