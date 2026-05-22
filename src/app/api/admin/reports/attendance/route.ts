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
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const def = defaultRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;
  const now = new Date();

  const [sessions, checkIns, noShows, waitlisted] = await Promise.all([
    prisma.studioSession.findMany({
      where: {
        isCancelled: false,
        endsAt: { lt: now },
        startsAt: { gte: from, lte: to },
      },
      include: {
        sessionType: { select: { name: true } },
        instructor: { select: { name: true } },
        _count: {
          select: {
            bookings: { where: { status: { in: ["CONFIRMED", "NO_SHOW"] } } },
          },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.booking.count({
      where: {
        status: { in: ["CONFIRMED", "NO_SHOW"] },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.booking.count({
      where: { status: "NO_SHOW", createdAt: { gte: from, lte: to } },
    }),
    prisma.booking.count({
      where: { status: "WAITLIST", createdAt: { gte: from, lte: to } },
    }),
  ]);

  // Waitlist count per session
  const sessionIds = sessions.map((s) => s.id);
  const waitlistCounts = sessionIds.length
    ? await prisma.booking.groupBy({
        by: ["studioSessionId"],
        where: { studioSessionId: { in: sessionIds }, status: "WAITLIST" },
        _count: { id: true },
      })
    : [];
  const waitlistMap: Record<string, number> = {};
  for (const w of waitlistCounts) {
    waitlistMap[w.studioSessionId] = w._count.id;
  }

  const totalSessions = sessions.length;
  const totalCapacity = sessions.reduce((s, sess) => s + sess.capacity, 0);
  const avgAttendanceRate =
    totalCapacity > 0
      ? sessions.reduce(
          (sum, s) =>
            sum + (s.capacity > 0 ? s._count.bookings / s.capacity : 0),
          0,
        ) / Math.max(1, totalSessions)
      : 0;

  // Heatmap: flat array of { dayOfWeek: 0-6, hour: 8-20, avgRate }
  // Accumulate sum and count per slot
  const slotSum: Record<string, number> = {};
  const slotCount: Record<string, number> = {};

  for (const s of sessions) {
    const dayStr = formatInTimeZone(s.startsAt, TZ, "yyyy-MM-dd");
    const hourStr = formatInTimeZone(s.startsAt, TZ, "HH");
    const [y, mo, d] = dayStr.split("-").map(Number);
    // JavaScript's Date month is 0-indexed
    const dow = new Date(y, mo - 1, d).getDay(); // 0=Sun..6=Sat
    const hour = parseInt(hourStr, 10);
    if (hour < 8 || hour > 20) continue;

    const key = `${dow}_${hour}`;
    const rate = s.capacity > 0 ? s._count.bookings / s.capacity : 0;
    slotSum[key] = (slotSum[key] ?? 0) + rate;
    slotCount[key] = (slotCount[key] ?? 0) + 1;
  }

  const heatmap: { dayOfWeek: number; hour: number; avgRate: number }[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    for (let hour = 8; hour <= 20; hour++) {
      const key = `${dow}_${hour}`;
      const count = slotCount[key] ?? 0;
      const avg = count > 0 ? (slotSum[key] ?? 0) / count : 0;
      heatmap.push({ dayOfWeek: dow, hour, avgRate: avg });
    }
  }

  return NextResponse.json({
    stats: {
      totalSessions,
      totalCheckIns: checkIns,
      noShows,
      avgAttendanceRate,
      waitlistConversions: waitlisted, // approximate — current waitlist bookings in range
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      sessionType: s.sessionType.name,
      instructor: s.instructor?.name ?? null,
      capacity: s.capacity,
      confirmedCount: s._count.bookings,
      waitlistCount: waitlistMap[s.id] ?? 0,
      attendanceRate:
        s.capacity > 0 ? s._count.bookings / s.capacity : 0,
    })),
    heatmap,
  });
}
