import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") ?? "upcoming";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const now = new Date();

  type SessionFilter = { startsAt: { gte: Date } | { lt: Date } };
  const sessionFilter: SessionFilter =
    statusParam === "upcoming"
      ? { startsAt: { gte: now } }
      : { startsAt: { lt: now } };

  let where;
  let order: "asc" | "desc" = "asc";

  if (statusParam === "past") {
    where = {
      userId,
      status: { in: ["CONFIRMED" as const, "NO_SHOW" as const] },
      studioSession: { startsAt: { lt: now } },
    };
    order = "desc";
  } else if (statusParam === "cancelled") {
    where = { userId, status: "CANCELLED" as const };
    order = "desc";
  } else {
    where = {
      userId,
      status: { in: ["CONFIRMED" as const, "WAITLIST" as const] },
      studioSession: { startsAt: { gte: now } },
    };
    order = "asc";
  }
  void sessionFilter;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        studioSession: {
          include: {
            sessionType: { select: { name: true } },
            location: { select: { name: true } },
            instructor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { studioSession: { startsAt: order } },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  // For past bookings, check which have tips so the UI can show the right state
  let tipBookingIds = new Set<string>();
  if (statusParam === "past" && bookings.length > 0) {
    const ids = bookings.map((b) => b.id);
    const tips = await prisma.tip.findMany({
      where: { bookingId: { in: ids } },
      select: { bookingId: true },
    });
    tipBookingIds = new Set(tips.map((t) => t.bookingId));
  }

  const enriched = bookings.map((b) => ({
    ...b,
    hasTip: tipBookingIds.has(b.id),
  }));

  return NextResponse.json({ bookings: enriched, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.studioSessionId) {
    return NextResponse.json(
      { error: "studioSessionId is required" },
      { status: 400 },
    );
  }

  const { studioSessionId } = body as { studioSessionId: string };
  const userId = session.user.id;

  const existing = await prisma.booking.findFirst({
    where: { userId, studioSessionId, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already booked" }, { status: 409 });
  }

  const studioSession = await prisma.studioSession.findUnique({
    where: { id: studioSessionId },
    include: {
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
  });
  if (!studioSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (studioSession.isCancelled) {
    return NextResponse.json(
      { error: "Session is cancelled" },
      { status: 400 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "No active membership" },
      { status: 403 },
    );
  }

  const confirmedCount = studioSession._count.bookings;
  const bookingStatus =
    confirmedCount >= studioSession.capacity ? "WAITLIST" : "CONFIRMED";

  const booking = await prisma.booking.create({
    data: {
      userId,
      studioSessionId,
      membershipId: membership.id,
      status: bookingStatus,
      source: "MEMBER_FREE",
    },
  });

  if (bookingStatus === "CONFIRMED") {
    await inngest.send({
      name: "booking/confirmed",
      data: { bookingId: booking.id, userId, studioSessionId },
    });

    const sessionToken = req.cookies.get("throw_session")?.value;
    if (sessionToken) {
      prisma.adTracking
        .findFirst({ where: { sessionId: sessionToken } })
        .then((t) => {
          if (t && !t.firstBookingAt) {
            prisma.adTracking
              .update({ where: { id: t.id }, data: { firstBookingAt: new Date() } })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  return NextResponse.json(
    { bookingId: booking.id, status: booking.status },
    { status: 201 },
  );
}
