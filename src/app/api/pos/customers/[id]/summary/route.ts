import { type NextRequest, NextResponse } from "next/server";
import { endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { getTicketBalance } from "@/lib/credits";
import { getClassCreditBalance, getCommitmentMonths, isMemberOrEnrolledStudent } from "@/lib/pos";
import { STUDIO_TIMEZONE } from "@/lib/timezone";
import { findUnsignedWaiver } from "@/lib/waivers";

export const dynamic = "force-dynamic";

/**
 * What the register shows when a customer is attached to an order: their
 * membership, tickets, stored value, class pack credits, today's bookings at
 * this studio and whether their waiver is on file. `?locationId=` is the
 * order's studio (required: bookings and the waiver are per studio).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });

  const allowed = await checkPermission(session.user.id, "canUsePos", locationId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, accountCreditCents: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const dayStart = fromZonedTime(startOfDay(nowMT), STUDIO_TIMEZONE);
  const dayEnd = fromZonedTime(endOfDay(nowMT), STUDIO_TIMEZONE);

  const [memberships, giftCards, classPackCredits, bookings, unsignedWaiver, commitmentMonths, firingEligible] =
    await Promise.all([
      // ACTIVE first, then PAUSED: the register cares about the one in force.
      prisma.membership.findMany({
        where: { userId: id, status: { in: ["ACTIVE", "PAUSED"] } },
        include: { plan: { select: { id: true, name: true, tier: true, classTicketsPerPeriod: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      prisma.giftCard.findMany({
        where: {
          isActive: true,
          balanceCents: { gt: 0 },
          OR: [{ purchasedById: id }, { redeemedById: id }],
        },
        select: { id: true, code: true, balanceCents: true },
        orderBy: { createdAt: "asc" },
      }),
      getClassCreditBalance(id),
      prisma.booking.findMany({
        where: {
          userId: id,
          status: { in: ["CONFIRMED", "WAITLIST"] },
          studioSession: { locationId, isCancelled: false, startsAt: { gte: dayStart, lte: dayEnd } },
        },
        include: {
          studioSession: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              sessionType: { select: { id: true, name: true, slug: true, kind: true } },
            },
          },
        },
        orderBy: { studioSession: { startsAt: "asc" } },
      }),
      findUnsignedWaiver(id, locationId),
      getCommitmentMonths(id),
      isMemberOrEnrolledStudent(id),
    ]);

  const membership = memberships[0] ?? null;
  const tickets = membership ? await getTicketBalance(membership.id) : null;

  return NextResponse.json({
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    membership: membership
      ? {
          id: membership.id,
          planId: membership.plan.id,
          planName: membership.plan.name,
          tier: membership.plan.tier,
          status: membership.status,
          currentPeriodEnd: membership.currentPeriodEnd,
          commitmentMonths,
        }
      : null,
    // null when there is no membership; `unlimited` plans have no count.
    tickets: tickets ? { remaining: tickets.balance, unlimited: tickets.unlimited } : null,
    accountCreditCents: customer.accountCreditCents,
    giftCards,
    giftCardBalanceCents: giftCards.reduce((sum, g) => sum + g.balanceCents, 0),
    classPackCredits,
    todaysBookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      source: b.source,
      quantity: b.quantity,
      studioSessionId: b.studioSession.id,
      name: b.studioSession.title ?? b.studioSession.sessionType.name,
      sessionTypeId: b.studioSession.sessionType.id,
      sessionTypeSlug: b.studioSession.sessionType.slug,
      kind: b.studioSession.sessionType.kind,
      startsAt: b.studioSession.startsAt,
      endsAt: b.studioSession.endsAt,
    })),
    waiverOnFile: unsignedWaiver === null,
    // May buy members-only products (member firing).
    canUseMemberFiring: firingEligible,
  });
}
