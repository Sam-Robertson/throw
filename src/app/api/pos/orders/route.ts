import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { POS_ORDER_INCLUDE } from "@/lib/pos";
import { forbiddenResponse, locationWhere, resolveLocationScope } from "@/lib/locationScope";
import type { Prisma } from "@prisma/client";

/** How long a staff member's own unparked open orders stay in the resume list. */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    customerId?: string;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const allowed = await checkPermission(session.user.id, "canUsePos", body.locationId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const order = await prisma.posOrder.create({
    data: {
      locationId: body.locationId,
      customerId: body.customerId ?? null,
      staffId: session.user.id,
    },
    include: POS_ORDER_INCLUDE,
  });

  return NextResponse.json(order, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const allowed = await checkPermission(session.user.id, "canUsePos", locationId ?? undefined);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Staff only see orders from the studios they're assigned to.
  let scope;
  try {
    scope = resolveLocationScope(session, locationId);
  } catch (err) {
    return forbiddenResponse(err);
  }

  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));

  // resumable=1 is the register's "Resume open order" list: open orders with
  // something on them at this studio — every parked order (any staff member can
  // pick one back up), plus this staff member's own orders from the last 12
  // hours. Parked orders come first.
  const resumable = searchParams.get("resumable") === "1";
  const excludeId = searchParams.get("excludeId");

  const where: Prisma.PosOrderWhereInput = resumable
    ? {
        ...locationWhere(scope, "locationId"),
        status: "OPEN",
        items: { some: {} },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { parkedAt: { not: null } },
          { staffId: session.user.id, createdAt: { gte: new Date(Date.now() - RESUME_WINDOW_MS) } },
        ],
      }
    : {
        ...locationWhere(scope, "locationId"),
        ...(status ? { status } : {}),
        ...(staffId ? { staffId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      };

  const [total, orders] = await Promise.all([
    prisma.posOrder.count({ where }),
    prisma.posOrder.findMany({
      where,
      orderBy: resumable
        ? [{ parkedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { items: true } },
        items: { select: { quantity: true } },
        payments: { select: { method: true } },
        customer: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      locationId: o.locationId,
      customerId: o.customerId,
      staffId: o.staffId,
      status: o.status,
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      taxCents: o.taxCents,
      tipCents: o.tipCents,
      totalCents: o.totalCents,
      note: o.note,
      completedAt: o.completedAt,
      voidedAt: o.voidedAt,
      voidReason: o.voidReason,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      parkedAt: o.parkedAt,
      walkInName: o.walkInName,
      customerName: o.customer ? (o.customer.name ?? o.customer.email) : null,
      itemCount: o._count.items,
      // Units rather than lines ("3 items" for a line of 3 pieces).
      itemQuantity: o.items.reduce((sum, i) => sum + i.quantity, 0),
      paymentMethods: [...new Set(o.payments.map((p) => p.method))],
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
