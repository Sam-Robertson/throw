import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { repriceOrder } from "@/lib/pos";
import { parseFiringMetadata } from "@/config/firingPrices";

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
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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

  // A drop-in is one seat for one customer, and a firing line is already
  // priced for the weight entered — neither can be multiplied.
  const quantityLocked = item.itemType === "DROP_IN" || parseFiringMetadata(item.metadata) !== null;
  if (quantityLocked && quantity !== item.quantity) {
    return NextResponse.json(
      {
        error: "QUANTITY_LOCKED",
        message: "The quantity can't be changed on this line. Remove it and add it again instead.",
      },
      { status: 400 },
    );
  }

  const lineCents = item.unitPriceCents * quantity;
  const discountCents = Math.min(
    lineCents,
    body.discountCents !== undefined ? Math.max(0, Math.floor(body.discountCents)) : item.discountCents,
  );
  const totalCents = lineCents - discountCents;

  await prisma.posOrderItem.update({
    where: { id: itemId },
    data: { quantity, discountCents, totalCents },
  });

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  return NextResponse.json({ ...updatedOrder, taxWarning });
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
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const item = await prisma.posOrderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.posOrderItem.delete({ where: { id: itemId } });

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  return NextResponse.json({ ...updatedOrder, taxWarning });
}
