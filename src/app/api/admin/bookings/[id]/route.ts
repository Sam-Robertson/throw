import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  CONFIRMED: ["NO_SHOW", "CANCELLED"],
  WAITLIST: ["CANCELLED"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { status?: string };

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
  if (!body.status || !allowed.includes(body.status as BookingStatus)) {
    return NextResponse.json(
      { error: "Invalid status transition" },
      { status: 400 },
    );
  }

  const newStatus = body.status as BookingStatus;
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === "CANCELLED" && { cancelledAt: new Date() }),
    },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true } },
          location: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
