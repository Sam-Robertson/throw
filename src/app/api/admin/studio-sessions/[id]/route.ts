import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type GuardResult = { error: NextResponse } | { error: null };

async function requireStaff(): Promise<GuardResult> {
  const session = await auth();
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  return { error: null };
}

const sessionIncludes = {
  sessionType: { select: { name: true, durationMinutes: true, capacity: true } },
  instructor: { select: { id: true, name: true } },
  _count: { select: { bookings: true } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.studioSession.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { instructorId, capacity, isCancelled } = body as Record<
    string,
    unknown
  >;

  // Cancel all confirmed bookings when a session is being cancelled
  if (isCancelled === true && !existing.isCancelled) {
    await prisma.booking.updateMany({
      where: { studioSessionId: id, status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  const updated = await prisma.studioSession.update({
    where: { id },
    data: {
      ...(instructorId !== undefined && {
        instructorId: instructorId ? String(instructorId) : null,
      }),
      ...(capacity !== undefined && { capacity: Number(capacity) }),
      ...(isCancelled !== undefined && { isCancelled: Boolean(isCancelled) }),
    },
    include: sessionIncludes,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;

  const bookingCount = await prisma.booking.count({
    where: { studioSessionId: id },
  });

  if (bookingCount > 0)
    return NextResponse.json(
      {
        error: `Cannot delete: ${bookingCount} booking${bookingCount === 1 ? "" : "s"} exist for this session`,
      },
      { status: 409 },
    );

  await prisma.studioSession.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
