import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json(
    { bookingId: booking.id, status: booking.status },
    { status: 201 },
  );
}
