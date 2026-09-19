import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
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
import {
  parseSessionOverrides,
  presentSession,
  sessionIncludes,
  type SessionWithIncludes,
} from "./shared";

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

  // Upcoming sessions of an archived class type (Momence's "Pay for Pottery
  // Pieces" slots, mostly) are hidden unless asked for. Past ones always show:
  // history stays on the class type it was booked under.
  const includeArchived = searchParams.get("includeArchived") === "1";

  const sessions = await prisma.studioSession.findMany({
    where: {
      startsAt: { gte: fromDate, lt: toDate },
      ...locationWhere(scope),
      ...(!includeArchived && {
        OR: [{ startsAt: { lt: new Date() } }, { sessionType: { archivedAt: null } }],
      }),
    },
    include: sessionIncludes,
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(sessions.map(presentSession));
}

export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { sessionTypeId, instructorId, localDate, localTime, capacityOverride, repeatWeekly, locationId } =
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
  if (!sessionType.isActive || sessionType.archivedAt !== null)
    return NextResponse.json(
      { error: "This class type is archived — restore it before scheduling it" },
      { status: 400 },
    );

  // A class type tied to one studio puts its sessions there. Catalog class
  // types run at every studio, so the session has to say which one: the
  // studio decides the price (src/lib/sellable.ts).
  const sessionLocationId = sessionType.locationId ?? (locationId ? String(locationId) : null);
  if (!sessionLocationId)
    return NextResponse.json({ error: "Choose the studio this session is held at" }, { status: 400 });
  if (!sessionType.locationId) {
    const location = await prisma.location.findUnique({ where: { id: sessionLocationId }, select: { id: true } });
    if (!location) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  if (!scopeAllows(resolveLocationScope(guard.session), sessionLocationId))
    return NextResponse.json(
      { error: "You don't have access to that location" },
      { status: 403 },
    );

  const overrides = parseSessionOverrides(body as Record<string, unknown>);
  if (!overrides.ok) return NextResponse.json({ error: overrides.error }, { status: 400 });

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
    locationId: sessionLocationId,
    capacity,
    ...overrides.value,
  };

  if (repeatCount === null) {
    const startsAt = fromMountainTime(String(localDate), String(localTime));

    const duplicate = await prisma.studioSession.findFirst({
      where: { sessionTypeId: sessionType.id, locationId: sessionLocationId, startsAt },
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

    return NextResponse.json(presentSession(session), { status: 201 });
  }

  // Repeat weekly: one session per week, same weekday and Mountain wall-clock
  // time, all sharing a seriesId. Occupied slots are skipped, not fatal.
  const seriesId = randomUUID();
  const created: SessionWithIncludes[] = [];
  const skipped: { startsAt: string; reason: string }[] = [];

  for (const date of weeklyLocalDates(String(localDate), repeatCount)) {
    const startsAt = fromMountainTime(date, String(localTime));

    const duplicate = await prisma.studioSession.findFirst({
      where: { sessionTypeId: sessionType.id, locationId: sessionLocationId, startsAt },
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

  return NextResponse.json({ created: created.map(presentSession), skipped, seriesId }, { status: 201 });
}
