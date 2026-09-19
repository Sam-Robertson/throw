import { type NextRequest, NextResponse } from "next/server";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { SELLABLE_SESSION_TYPE } from "@/lib/sellable";
import { STUDIO_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/** How far ahead the Drop-ins tab lists sessions (today plus the next 6 days). */
const DROP_IN_DAYS = 7;

function locationScope(locationId: string | null) {
  if (!locationId) return {};
  return { OR: [{ locationId }, { locationId: null }] };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const allowed = await checkPermission(session.user.id, "canUsePos", locationId ?? undefined);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = locationScope(locationId);

  // Drop-ins book a specific session, so the tab lists real sessions at this
  // studio, Mountain Time days, starting today. Only sellable class types:
  // free Momence leftovers and member-only classes are not POS items.
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const from = fromZonedTime(startOfDay(nowMT), STUDIO_TIMEZONE);
  const to = fromZonedTime(endOfDay(addDays(nowMT, DROP_IN_DAYS - 1)), STUDIO_TIMEZONE);

  const [retailProducts, sessionTypes, membershipPlans, upcomingSessions] = await Promise.all([
    prisma.retailProduct.findMany({
      where: { isActive: true, ...scope },
      select: { id: true, name: true, priceCents: true, inventory: true },
      orderBy: { name: "asc" },
    }),
    prisma.sessionType.findMany({
      where: { ...SELLABLE_SESSION_TYPE, ...scope },
      select: { id: true, name: true, dropInPriceCents: true },
      orderBy: { name: "asc" },
    }),
    prisma.membershipPlan.findMany({
      where: { isActive: true, ...scope },
      select: { id: true, name: true, price: true, billingIntervalDays: true },
      orderBy: { name: "asc" },
    }),
    locationId
      ? prisma.studioSession.findMany({
          where: {
            locationId,
            isCancelled: false,
            startsAt: { gte: from, lte: to },
            sessionType: SELLABLE_SESSION_TYPE,
          },
          include: {
            sessionType: { select: { id: true, name: true, dropInPriceCents: true } },
            instructor: { select: { name: true } },
            _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
          },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    retailProducts: retailProducts.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      stock: p.inventory,
    })),
    sessionTypes: sessionTypes.map((s) => ({
      id: s.id,
      name: s.name,
      dropInPriceCents: s.dropInPriceCents,
    })),
    membershipPlans: membershipPlans.map((m) => ({
      id: m.id,
      name: m.name,
      priceInCents: m.price,
      billingIntervalDays: m.billingIntervalDays,
    })),
    upcomingSessions: upcomingSessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      sessionTypeId: s.sessionType.id,
      name: s.sessionType.name,
      dropInPriceCents: s.sessionType.dropInPriceCents,
      instructorName: s.instructor?.name ?? null,
      capacity: s.capacity,
      confirmedCount: s._count.bookings,
    })),
  });
}
