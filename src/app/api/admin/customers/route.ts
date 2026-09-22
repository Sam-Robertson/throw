import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customerScopeWhere, requireStaffScope } from "@/lib/staffScope";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guard = await requireStaffScope(searchParams.get("locationId"));
  if (guard.error) return guard.error;

  // Customers visible to this scope — see customerScopeWhere (walk-ins with no
  // bookings are visible to every studio).
  const scopeWhere = customerScopeWhere(guard.scope);
  const q = searchParams.get("q")?.trim() ?? "";

  // Typeahead mode (no page param): return simple array for TaskForm/etc.
  // Matches name, email, or phone (by digits, so "801 555" finds +18015550010).
  if (!searchParams.has("page")) {
    if (!q) return NextResponse.json([]);
    const qDigits = q.replace(/\D/g, "");
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          ...(qDigits.length >= 4 ? [{ phone: { contains: qDigits } }] : []),
        ],
        AND: [scopeWhere],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 10,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(customers);
  }

  // Paginated mode for admin customer list
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    }),
    AND: [scopeWhere],
  };

  const now = new Date();

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        memberships: {
          where: { status: { in: ["ACTIVE", "PAUSED"] } },
          select: { plan: { select: { name: true } }, status: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        bookings: {
          where: { status: { not: "CANCELLED" } },
          select: { studioSession: { select: { startsAt: true } } },
          orderBy: { studioSession: { startsAt: "desc" } },
          take: 1,
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ["CONFIRMED", "WAITLIST"] },
                studioSession: { startsAt: { gte: now } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: c.createdAt,
    activeMembership: c.memberships[0]?.plan.name ?? null,
    membershipStatus: c.memberships[0]?.status ?? null,
    upcomingBookingCount: c._count.bookings,
    lastBookingAt: c.bookings[0]?.studioSession.startsAt ?? null,
  }));

  return NextResponse.json({ customers: result, total, page, limit });
}
