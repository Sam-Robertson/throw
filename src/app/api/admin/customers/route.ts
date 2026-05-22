import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  // Typeahead mode (no page param): return simple array for TaskForm/etc.
  if (!searchParams.has("page")) {
    if (!q) return NextResponse.json([]);
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(customers);
  }

  // Paginated mode for admin customer list
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = q
    ? {
        role: "CUSTOMER" as const,
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { role: "CUSTOMER" as const };

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
