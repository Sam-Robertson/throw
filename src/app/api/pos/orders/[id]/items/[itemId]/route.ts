import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { MEMBER_FIRING_KIND, manualDiscountCents, metadataObject, repriceOrder } from "@/lib/pos";

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
    /** The manual dollar discount on this line. Named discounts are separate (see /discounts). */
    discountCents?: number;
    /** Free-text line note ("blue mug, chipped"). Null or "" clears it. */
    note?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const quantity =
    body.quantity !== undefined ? Math.max(1, Math.floor(body.quantity)) : item.quantity;

  // A drop-in is one seat for one customer, and a firing or by-weight line is
  // already priced for the weight entered — none of them can be multiplied.
  const meta = metadataObject(item.metadata);
  const quantityLocked =
    item.itemType === "DROP_IN" ||
    // "FIRING" is the old Clay & firing tab's custom line; open ones may still exist.
    meta.kind === "FIRING" ||
    meta.kind === MEMBER_FIRING_KIND ||
    meta.unit === "LB";
  if (quantityLocked && quantity !== item.quantity) {
    return NextResponse.json(
      {
        error: "QUANTITY_LOCKED",
        message: "The quantity can't be changed on this line. Remove it and add it again instead.",
      },
      { status: 400 },
    );
  }

  if (body.quantity !== undefined && quantity > item.quantity && item.itemType === "RETAIL" && item.refId) {
    const product = await prisma.retailProduct.findUnique({
      where: { id: item.refId },
      select: { trackInventory: true, inventory: true },
    });
    if (product?.trackInventory && quantity > product.inventory) {
      return NextResponse.json({ error: `Only ${product.inventory} in stock` }, { status: 409 });
    }
  }

  // Only the manual discount is set here. repriceOrder works out the line's
  // whole discount (manual, then its share of any named discounts) and total.
  const lineCents = item.unitPriceCents * quantity;
  const manualCents = Math.min(
    lineCents,
    body.discountCents !== undefined && Number.isFinite(body.discountCents)
      ? Math.max(0, Math.floor(body.discountCents))
      : manualDiscountCents(item),
  );

  await prisma.posOrderItem.update({
    where: { id: itemId },
    data: {
      quantity,
      discountCents: manualCents,
      totalCents: lineCents - manualCents,
      metadata: { ...meta, manualDiscountCents: manualCents },
      ...(body.note !== undefined
        ? { note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null }
        : {}),
    },
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
