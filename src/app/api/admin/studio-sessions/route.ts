import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromMountainTime, STUDIO_TIMEZONE } from "@/lib/timezone";
import {
  forbiddenResponse,
  locationWhere,
  resolveLocationScope,
  scopeAllows,
} from "@/lib/locationScope";
import { startOfWeek, addDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/** Most sessions a single "repeat weekly" create may produce. */
const MAX_REPEAT_WEEKLY = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

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

const sessionIncludes = {
  sessionType: { select: { id: true, name: true, durationMinutes: true, capacity: true } },
  instructor: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  _count: { select: { bookings: true } },
} as const;

type SessionWithIncludes = Prisma.StudioSessionGetPayload<{ include: typeof sessionIncludes }>;

/**
 * The Mountain calendar dates of `count` weekly occurrences starting on
 * `localDate`. The arithmetic is done on a UTC-noon instant, which has no DST,
 * so each step is exactly one calendar week; the wall-clock time is applied
 * per date afterwards by fromMountainTime, which picks MST or MDT for that day.
 */
function weeklyLocalDates(localDate: string, count: number): string[] {
  const base = new Date(`${localDate}T12:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    new Date(base + i * 7 * DAY_MS).toISOString().slice(0, 10),
  );
}

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  let scope;
  try {
    scope = resolveLocationScope(guard.session, searchParams.get("locationId"));
  } catch (err) {
    return forbiddenResponse(err);
  }

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
    where: {
      startsAt: { gte: fromDate, lt: toDate },
      ...locationWhere(scope),
    },
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

  const { sessionTypeId, instructorId, localDate, localTime, capacityOverride, repeatWeekly } =
    body as Record<string, unknown>;

  if (!sessionTypeId || !localDate || !localTime)
    return NextResponse.json(
      { error: "sessionTypeId, localDate, and localTime are required" },
      { status: 400 },
    );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(localDate)) || !/^\d{2}:\d{2}$/.test(String(localTime)))
    return NextResponse.json(
      { error: "localDate must be YYYY-MM-DD and localTime HH:MM" },
      { status: 400 },
    );

  let repeatCount: number | null = null;
  if (repeatWeekly !== undefined && repeatWeekly !== null) {
    const count =
      typeof repeatWeekly === "object" ? (repeatWeekly as { count?: unknown }).count : undefined;
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_REPEAT_WEEKLY
    )
      return NextResponse.json(
        { error: `repeatWeekly.count must be a whole number from 1 to ${MAX_REPEAT_WEEKLY}` },
        { status: 400 },
      );
    repeatCount = count;
  }

  const sessionType = await prisma.sessionType.findUnique({
    where: { id: String(sessionTypeId) },
  });
  if (!sessionType)
    return NextResponse.json({ error: "Session type not found" }, { status: 404 });

  // New sessions take the class type's studio, so that's what must be in scope.
  if (!scopeAllows(resolveLocationScope(guard.session), sessionType.locationId))
    return NextResponse.json(
      { error: "You don't have access to that location" },
      { status: 403 },
    );

  const capacity =
    capacityOverride !== undefined && capacityOverride !== null
      ? Number(capacityOverride)
      : sessionType.capacity;
  if (!Number.isInteger(capacity) || capacity < 1)
    return NextResponse.json(
      { error: "capacityOverride must be a whole number of at least 1" },
      { status: 400 },
    );

  const durationMs = sessionType.durationMinutes * 60 * 1000;
  const baseData = {
    sessionTypeId: sessionType.id,
    instructorId: instructorId ? String(instructorId) : null,
    locationId: sessionType.locationId,
    capacity,
  };

  if (repeatCount === null) {
    const startsAt = fromMountainTime(String(localDate), String(localTime));

    const duplicate = await prisma.studioSession.findFirst({
      where: { sessionTypeId: sessionType.id, startsAt },
    });
    if (duplicate)
      return NextResponse.json(
        { error: "A session of this type already exists at this time" },
        { status: 409 },
      );

    const session = await prisma.studioSession.create({
      data: { ...baseData, startsAt, endsAt: new Date(startsAt.getTime() + durationMs) },
      include: sessionIncludes,
    });

    return NextResponse.json(session, { status: 201 });
  }

  // Repeat weekly: one session per week, same weekday and Mountain wall-clock
  // time, all sharing a seriesId. Occupied slots are skipped, not fatal.
  const seriesId = randomUUID();
  const created: SessionWithIncludes[] = [];
  const skipped: { startsAt: string; reason: string }[] = [];

  for (const date of weeklyLocalDates(String(localDate), repeatCount)) {
    const startsAt = fromMountainTime(date, String(localTime));

    const duplicate = await prisma.studioSession.findFirst({
      where: { sessionTypeId: sessionType.id, startsAt },
      select: { id: true },
    });
    if (duplicate) {
      skipped.push({
        startsAt: startsAt.toISOString(),
        reason: "A session of this type already exists at this time",
      });
      continue;
    }

    created.push(
      await prisma.studioSession.create({
        data: {
          ...baseData,
          seriesId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMs),
        },
        include: sessionIncludes,
      }),
    );
  }

  if (created.length === 0)
    return NextResponse.json(
      {
        error: "Every week already has a session of this type at this time",
        created,
        skipped,
        seriesId: null,
      },
      { status: 409 },
    );

  return NextResponse.json({ created, skipped, seriesId }, { status: 201 });
}
