import { type NextRequest, NextResponse } from "next/server";
import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { CLASS_PRICE_SELECT, SELLABLE_SESSION_TYPE, resolveClassPriceCents } from "@/lib/sellable";
import { STUDIO_TIMEZONE } from "@/lib/timezone";
import { GROUP_EVENT_LOOKBACK_DAYS, GROUP_EVENT_SESSION_TYPE, getFiringProducts } from "@/lib/pos";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from "@/config/taxCodes";

export const dynamic = "force-dynamic";

/** How far ahead the Classes tab lists sessions (today plus the next 7 days). */
const DROP_IN_DAYS = 8;

/** Courses are sold ahead of time, so they are listed this far out. */
const COURSE_HORIZON_DAYS = 120;

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

  // A class sale books a specific session, so the tab lists real sessions at this
  // studio, Mountain Time days, starting today. Only sellable class types:
  // free Momence leftovers and member-only classes are not POS items.
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const from = fromZonedTime(startOfDay(nowMT), STUDIO_TIMEZONE);
  const to = fromZonedTime(endOfDay(addDays(nowMT, DROP_IN_DAYS - 1)), STUDIO_TIMEZONE);

  const now = new Date();
  const [retailProducts, sessionTypes, membershipPlans, upcomingSessions, staffDiscounts, groupEvents, firing, courseSessions] = await Promise.all([
    // Sellable products only: active, not archived, and priced (OPEN catalog
    // items stay out of the register until the client gives a price).
    prisma.retailProduct.findMany({
      where: { isActive: true, isPriced: true, archivedAt: null, ...scope },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.sessionType.findMany({
      where: { ...SELLABLE_SESSION_TYPE, ...scope },
      select: { ...CLASS_PRICE_SELECT, name: true, priceUnit: true },
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
            sessionType: { select: { ...CLASS_PRICE_SELECT, name: true, kind: true } },
            instructor: { select: { name: true } },
            _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
          },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
    // Discounts staff can put on an order by hand at this studio. Promo codes
    // are typed in (POST …/discounts { code }); automatic ones apply themselves.
    prisma.discountCode.findMany({
      where: {
        appliesVia: "STAFF",
        isActive: true,
        archivedAt: null,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          locationId ? { OR: [{ locationId: null }, { locationId }] } : {},
        ],
      },
      include: { sessionType: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    // Recent group events here, for discounts that need one (GROUPEXTRAS20).
    locationId
      ? prisma.studioSession.findMany({
          where: {
            locationId,
            isCancelled: false,
            startsAt: { gte: subDays(from, GROUP_EVENT_LOOKBACK_DAYS - 1), lte: to },
            sessionType: GROUP_EVENT_SESSION_TYPE,
          },
          select: { id: true, title: true, startsAt: true, sessionType: { select: { name: true } } },
          orderBy: { startsAt: "desc" },
        })
      : Promise.resolve([]),
    getFiringProducts(),
    // Courses: every session that hasn't finished yet, grouped into one entry
    // per course below. Selling one books the customer into all of them.
    locationId
      ? prisma.studioSession.findMany({
          where: {
            locationId,
            isCancelled: false,
            endsAt: { gt: now },
            startsAt: { lte: addDays(now, COURSE_HORIZON_DAYS) },
            sessionType: { ...SELLABLE_SESSION_TYPE, kind: "COURSE" },
          },
          include: {
            sessionType: { select: { ...CLASS_PRICE_SELECT, name: true } },
            instructor: { select: { name: true } },
            _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
          },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // One entry per course: sessions sharing a seriesId, or a lone session.
  const courseGroups = new Map<string, typeof courseSessions>();
  for (const s of courseSessions) {
    const key = s.seriesId ?? s.id;
    courseGroups.set(key, [...(courseGroups.get(key) ?? []), s]);
  }
  // When the course began and how long it is, counting sessions already held.
  const seriesIds = [...new Set(courseSessions.flatMap((s) => (s.seriesId ? [s.seriesId] : [])))];
  const seriesStats =
    seriesIds.length > 0
      ? await prisma.studioSession.groupBy({
          by: ["seriesId"],
          where: { seriesId: { in: seriesIds }, locationId, isCancelled: false },
          _min: { startsAt: true },
          _count: { _all: true },
        })
      : [];
  const courses = [...courseGroups.entries()]
    .map(([key, remaining]) => {
      const [first] = remaining;
      const stats = seriesStats.find((g) => g.seriesId === first.seriesId);
      const startsAt = stats?._min.startsAt ?? first.startsAt;
      return {
        key,
        seriesId: first.seriesId,
        // The first session still to come; the sale is keyed on it.
        sessionId: first.id,
        sessionTypeId: first.sessionType.id,
        name: first.title ?? first.sessionType.name,
        priceCents: resolveClassPriceCents({
          sessionType: first.sessionType,
          locationId: first.locationId,
          priceCentsOverride: first.priceCentsOverride,
        }),
        instructorName: first.instructor?.name ?? null,
        startsAt,
        started: startsAt < now,
        totalSessions: stats?._count._all ?? remaining.length,
        // A seat in the course needs a seat in every remaining session.
        spotsLeft: Math.min(...remaining.map((s) => Math.max(0, s.capacity - s._count.bookings))),
        sessions: remaining.map((s) => ({
          id: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          capacity: s.capacity,
          confirmedCount: s._count.bookings,
        })),
      };
    })
    .filter((c) => c.priceCents > 0);

  const products = retailProducts.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    unit: p.unit,
    priceCents: p.priceCents,
    isPriced: p.isPriced,
    minChargeCents: p.minChargeCents,
    membersOnly: p.membersOnly,
    trackInventory: p.trackInventory,
    // null when stock isn't tracked (pieces, firing, clay, packs, shipping).
    stock: p.trackInventory ? p.inventory : null,
    classCredits: p.classCredits,
    imageUrl: p.imageUrl,
    sortOrder: p.sortOrder,
  }));

  return NextResponse.json({
    // Shelf retail only, in the shape the register has always used. Catalog
    // products (pieces, firing, clay, packs, shipping) are in `products`.
    retailProducts: retailProducts
      .filter((p) => p.category === "RETAIL")
      .map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        stock: p.inventory,
        trackInventory: p.trackInventory,
      })),
    // Every sellable product, and the same list grouped by category in catalog order.
    products,
    productGroups: PRODUCT_CATEGORIES.map((category) => ({
      category,
      label: PRODUCT_CATEGORY_LABELS[category],
      products: products.filter((p) => p.category === category),
    })).filter((g) => g.products.length > 0),
    staffDiscounts: staffDiscounts.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name ?? d.code,
      description: d.description,
      type: d.type,
      value: d.value,
      scope: d.scope,
      sessionTypeId: d.sessionTypeId,
      sessionTypeName: d.sessionType?.name ?? null,
      productSlug: d.productSlug,
      maxUnits: d.maxUnits,
      maxUsesPerCustomerPerYear: d.maxUsesPerCustomerPerYear,
      requiresNote: d.requiresNote,
      requiresGroupEvent: d.requiresGroupEvent,
      // Needs a customer on the order (the yearly limit is per customer).
      requiresCustomer: d.maxUsesPerCustomerPerYear != null,
    })),
    groupEventSessions: groupEvents.map((g) => ({
      id: g.id,
      name: g.title ?? g.sessionType.name,
      startsAt: g.startsAt,
    })),
    // Member glaze firing price book, or null when the firing products aren't set up.
    firingRates: firing
      ? {
          ...firing.rates,
          standardProductId: firing.standard.id,
          oversizeProductId: firing.oversize.id,
        }
      : null,
    sessionTypes: sessionTypes
      .map((s) => ({
        id: s.id,
        name: s.name,
        dropInPriceCents: resolveClassPriceCents({ sessionType: s, locationId }),
        priceUnit: s.priceUnit,
      }))
      .filter((s) => s.dropInPriceCents > 0),
    membershipPlans: membershipPlans.map((m) => ({
      id: m.id,
      name: m.name,
      priceInCents: m.price,
      billingIntervalDays: m.billingIntervalDays,
    })),
    courses,
    upcomingSessions: upcomingSessions
      .map((s) => ({ ...s, priceCents: resolveClassPriceCents({ sessionType: s.sessionType, locationId: s.locationId, priceCentsOverride: s.priceCentsOverride }) }))
      // A session with no real price at this studio is not a POS item.
      .filter((s) => s.priceCents > 0)
      .map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      sessionTypeId: s.sessionType.id,
      name: s.title ?? s.sessionType.name,
      kind: s.sessionType.kind,
      seriesId: s.seriesId,
      dropInPriceCents: s.priceCents,
      instructorName: s.instructor?.name ?? null,
      capacity: s.capacity,
      confirmedCount: s._count.bookings,
    })),
  });
}
