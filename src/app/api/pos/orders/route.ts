import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    customerId?: string;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const order = await prisma.posOrder.create({
    data: {
      locationId: body.locationId,
      customerId: body.customerId ?? null,
      staffId: session.user.id,
    },
    include: { items: true, payments: true },
  });

  return NextResponse.json(order, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));

  const where: Prisma.PosOrderWhereInput = {
    ...(locationId ? { locationId } : {}),
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { items: true } },
        payments: { select: { method: true } },
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
      itemCount: o._count.items,
      paymentMethods: [...new Set(o.payments.map((p) => p.method))],
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
