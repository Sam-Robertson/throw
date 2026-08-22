import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { recalculateOrderTotals } from "@/lib/pos";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, itemId } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const item = await prisma.posOrderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    quantity?: number;
    discountCents?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const quantity =
    body.quantity !== undefined ? Math.max(1, Math.floor(body.quantity)) : item.quantity;
  const discountCents =
    body.discountCents !== undefined ? Math.max(0, Math.floor(body.discountCents)) : item.discountCents;
  const totalCents = item.unitPriceCents * quantity - discountCents;

  await prisma.posOrderItem.update({
    where: { id: itemId },
    data: { quantity, discountCents, totalCents },
  });

  const updatedOrder = await recalculateOrderTotals(id);

  return NextResponse.json(updatedOrder);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, itemId } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const item = await prisma.posOrderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.posOrderItem.delete({ where: { id: itemId } });

  const updatedOrder = await recalculateOrderTotals(id);

  return NextResponse.json(updatedOrder);
}
