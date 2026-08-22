import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STUDIO_TIMEZONE } from "@/lib/timezone";
import { startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

function defaultMonthRange() {
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  return {
    from: fromZonedTime(startOfMonth(nowMT), STUDIO_TIMEZONE),
    to: fromZonedTime(endOfMonth(nowMT), STUDIO_TIMEZONE),
  };
}

interface ByInstructor {
  instructorId: string;
  instructorName: string;
  totalAmountCents: number;
  count: number;
  unpaidAmountCents: number;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const instructorId = searchParams.get("instructorId");

  const def = defaultMonthRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;

  const tips = await prisma.tip.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(instructorId ? { instructorId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Tip has no Prisma relations to Booking/User (only `location`) — batch-fetch and join manually.
  const bookingIds = [...new Set(tips.map((t) => t.bookingId))];
  const userIds = [...new Set(tips.flatMap((t) => [t.customerId, t.instructorId]))];

  const [bookings, users] = await Promise.all([
    bookingIds.length
      ? prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: {
            id: true,
            studioSession: {
              select: { startsAt: true, sessionType: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = tips.map((t) => {
    const booking = bookingMap.get(t.bookingId);
    const instructor = userMap.get(t.instructorId);
    const customer = userMap.get(t.customerId);
    return {
      id: t.id,
      createdAt: t.createdAt,
      amountInCents: t.amountInCents,
      paidOutAt: t.paidOutAt,
      instructor: {
        id: t.instructorId,
        name: instructor?.name ?? instructor?.email ?? "Unknown",
      },
      customer: {
        id: t.customerId,
        name: customer?.name ?? customer?.email ?? "Unknown",
      },
      booking: {
        startsAt: booking?.studioSession.startsAt ?? null,
        sessionTypeName: booking?.studioSession.sessionType.name ?? null,
      },
    };
  });

  const totalAmountCents = tips.reduce((s, t) => s + t.amountInCents, 0);
  const count = tips.length;
  const unpaidAmountCents = tips
    .filter((t) => !t.paidOutAt)
    .reduce((s, t) => s + t.amountInCents, 0);

  const byInstructorMap = new Map<string, ByInstructor>();
  for (const t of tips) {
    const instructor = userMap.get(t.instructorId);
    const name = instructor?.name ?? instructor?.email ?? "Unknown";
    const entry = byInstructorMap.get(t.instructorId) ?? {
      instructorId: t.instructorId,
      instructorName: name,
      totalAmountCents: 0,
      count: 0,
      unpaidAmountCents: 0,
    };
    entry.totalAmountCents += t.amountInCents;
    entry.count += 1;
    if (!t.paidOutAt) entry.unpaidAmountCents += t.amountInCents;
    byInstructorMap.set(t.instructorId, entry);
  }
  const byInstructor = Array.from(byInstructorMap.values()).sort(
    (a, b) => b.totalAmountCents - a.totalAmountCents,
  );

  return NextResponse.json({
    tips: rows,
    summary: { totalAmountCents, count, unpaidAmountCents, byInstructor },
  });
}
