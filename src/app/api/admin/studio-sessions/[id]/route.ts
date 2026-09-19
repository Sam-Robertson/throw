import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { StudioSession } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveLocationScope, scopeAllows } from "@/lib/locationScope";
import { parseSessionOverrides, presentSession, sessionIncludes } from "../shared";

type GuardResult =
  | { error: NextResponse; session: null }
  | { error: null; session: Session };

async function requireStaff(): Promise<GuardResult> {
  const session = await auth();
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  return { error: null, session };
}

type LoadResult =
  | { error: NextResponse; existing: null }
  | { error: null; existing: StudioSession };

/** Loads a session, returning 404 if missing and 403 if outside the caller's locations. */
async function loadScopedSession(id: string, session: Session): Promise<LoadResult> {
  const existing = await prisma.studioSession.findUnique({ where: { id } });
  if (!existing)
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      existing: null,
    };
  if (!scopeAllows(resolveLocationScope(session), existing.locationId))
    return {
      error: NextResponse.json(
        { error: "You don't have access to that location" },
        { status: 403 },
      ),
      existing: null,
    };
  return { error: null, existing };
}

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

  const loaded = await loadScopedSession(id, guard.session);
  if (loaded.error) return loaded.error;
  const existing = loaded.existing;

  const { instructorId, capacity, isCancelled } = body as Record<
    string,
    unknown
  >;

  const overrides = parseSessionOverrides(body as Record<string, unknown>);
  if (!overrides.ok) return NextResponse.json({ error: overrides.error }, { status: 400 });

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
      ...overrides.value,
    },
    include: sessionIncludes,
  });

  return NextResponse.json(presentSession(updated));
}

/**
 * Deletes a session. With `?scope=series`, deletes this session and every
 * later session in its repeat-weekly series — all or nothing: if any of them
 * has a booking, nothing is deleted and the 409 lists which ones.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;

  const loaded = await loadScopedSession(id, guard.session);
  if (loaded.error) return loaded.error;

  const scopeParam = new URL(req.url).searchParams.get("scope");
  if (scopeParam === "series") return deleteSeriesFrom(loaded.existing);
  if (scopeParam !== null)
    return NextResponse.json(
      { error: 'scope must be "series" or omitted' },
      { status: 400 },
    );

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

async function deleteSeriesFrom(existing: StudioSession) {
  if (!existing.seriesId)
    return NextResponse.json(
      { error: "This session is not part of a repeating series" },
      { status: 400 },
    );

  const targets = await prisma.studioSession.findMany({
    where: { seriesId: existing.seriesId, startsAt: { gte: existing.startsAt } },
    select: { id: true, startsAt: true, _count: { select: { bookings: true } } },
    orderBy: { startsAt: "asc" },
  });

  // Any booking row blocks deletion, cancelled ones included: Booking has a
  // required foreign key to StudioSession, so the delete would fail on them
  // anyway (same rule as the single-session delete above).
  const withBookings = targets.filter((t) => t._count.bookings > 0);
  if (withBookings.length > 0)
    return NextResponse.json(
      {
        error: `Cannot delete the series: ${withBookings.length} session${withBookings.length === 1 ? " has" : "s have"} bookings`,
        sessionsWithBookings: withBookings.map((t) => ({
          id: t.id,
          startsAt: t.startsAt.toISOString(),
          bookingCount: t._count.bookings,
        })),
      },
      { status: 409 },
    );

  const ids = targets.map((t) => t.id);
  // `bookings: none` re-checks at delete time, so a booking made between the
  // check above and here keeps its session rather than failing the delete.
  const result = await prisma.studioSession.deleteMany({
    where: { id: { in: ids }, bookings: { none: {} } },
  });

  return NextResponse.json({ deleted: result.count, ids });
}
