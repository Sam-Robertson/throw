import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkPermission(session.user.id, "canViewTips");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const def = defaultMonthRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;

  const [tipsInRange, allTimeTips] = await Promise.all([
    prisma.tip.findMany({
      where: { instructorId: session.user.id, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tip.findMany({
      where: { instructorId: session.user.id },
      select: { amountInCents: true },
    }),
  ]);

  const bookingIds = [...new Set(tipsInRange.map((t) => t.bookingId))];
  const customerIds = [...new Set(tipsInRange.map((t) => t.customerId))];

  const [bookings, customers] = await Promise.all([
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
    customerIds.length
      ? prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const customerMap = new Map(customers.map((u) => [u.id, u]));

  const rows = tipsInRange.map((t) => {
    const booking = bookingMap.get(t.bookingId);
    const customer = customerMap.get(t.customerId);
    return {
      id: t.id,
      createdAt: t.createdAt,
      amountInCents: t.amountInCents,
      paidOutAt: t.paidOutAt,
      customerName: customer?.name ?? customer?.email ?? "Unknown",
      sessionTypeName: booking?.studioSession.sessionType.name ?? null,
      startsAt: booking?.studioSession.startsAt ?? null,
    };
  });

  const totalAmountCents = tipsInRange.reduce((s, t) => s + t.amountInCents, 0);
  const count = tipsInRange.length;
  const unpaidAmountCents = tipsInRange
    .filter((t) => !t.paidOutAt)
    .reduce((s, t) => s + t.amountInCents, 0);
  const allTimeTotalCents = allTimeTips.reduce((s, t) => s + t.amountInCents, 0);

  return NextResponse.json({
    tips: rows,
    summary: { totalAmountCents, count, unpaidAmountCents, allTimeTotalCents },
  });
}
