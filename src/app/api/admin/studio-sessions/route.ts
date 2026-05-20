import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromMountainTime, STUDIO_TIMEZONE } from "@/lib/timezone";
import { startOfWeek, addDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

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

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  let fromDate: Date;
  let toDate: Date;

  if (fromParam && toParam) {
    fromDate = new Date(fromParam);
    toDate = new Date(toParam);
  } else {
    // Default: current week Mon–Sun in Mountain Time
    const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
    const weekStartMT = startOfWeek(nowMT, { weekStartsOn: 1 });
    fromDate = fromZonedTime(weekStartMT, STUDIO_TIMEZONE);
    toDate = addDays(fromDate, 7);
  }

  const sessions = await prisma.studioSession.findMany({
    where: { startsAt: { gte: fromDate, lt: toDate } },
    include: sessionIncludes,
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { sessionTypeId, instructorId, localDate, localTime, capacityOverride } =
    body as Record<string, unknown>;

  if (!sessionTypeId || !localDate || !localTime)
    return NextResponse.json(
      { error: "sessionTypeId, localDate, and localTime are required" },
      { status: 400 },
    );

  const sessionType = await prisma.sessionType.findUnique({
    where: { id: String(sessionTypeId) },
  });
  if (!sessionType)
    return NextResponse.json({ error: "Session type not found" }, { status: 404 });

  const startsAt = fromMountainTime(String(localDate), String(localTime));
  const endsAt = new Date(
    startsAt.getTime() + sessionType.durationMinutes * 60 * 1000,
  );

  const duplicate = await prisma.studioSession.findFirst({
    where: { sessionTypeId: String(sessionTypeId), startsAt },
  });
  if (duplicate)
    return NextResponse.json(
      { error: "A session of this type already exists at this time" },
      { status: 409 },
    );

  const session = await prisma.studioSession.create({
    data: {
      sessionTypeId: String(sessionTypeId),
      instructorId: instructorId ? String(instructorId) : null,
      startsAt,
      endsAt,
      capacity:
        capacityOverride !== undefined
          ? Number(capacityOverride)
          : sessionType.capacity,
    },
    include: sessionIncludes,
  });

  return NextResponse.json(session, { status: 201 });
}
