import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { recalculateOrderTotals } from "@/lib/pos";
import type { Prisma } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      customer: { select: { id: true, name: true, email: true } },
      staff: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    customerId?: string | null;
    note?: string | null;
    tipCents?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Prisma.PosOrderUpdateInput = {};
  if (body.customerId !== undefined) {
    data.customer = body.customerId ? { connect: { id: body.customerId } } : { disconnect: true };
  }
  if (body.note !== undefined) {
    data.note = body.note;
  }

  if (Object.keys(data).length > 0) {
    await prisma.posOrder.update({ where: { id }, data });
  }

  const tipCents =
    body.tipCents !== undefined ? Math.max(0, Math.floor(body.tipCents)) : undefined;
  const updatedOrder = await recalculateOrderTotals(id, tipCents);

  return NextResponse.json(updatedOrder);
}
