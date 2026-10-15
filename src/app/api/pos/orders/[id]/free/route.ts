import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { metadataObject, repriceOrder } from "@/lib/pos";

/**
 * Makes one line, or the whole order, free: a 100% manual discount on each
 * line, with the reason written on the order so it is explained in the order
 * history and the sales report. The order then completes with nothing to pay
 * (see payments/no-charge). Any staff member who can use the register can do
 * this; the reason is what keeps it honest.
 *
 * Body: { reason: string, itemId?: string }. Without itemId every line goes free.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: { items: true, payments: { select: { status: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }
  if (order.payments.some((p) => p.status === "SUCCEEDED" || p.status === "PENDING")) {
    return NextResponse.json(
      {
        error: "PAYMENT_STARTED",
        message: "This order already has a payment, so its prices can't change. Remove the payment first.",
      },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as { reason?: string; itemId?: string } | null;
  const reason = body?.reason?.trim().slice(0, 500) ?? "";
  if (!reason) {
    return NextResponse.json(
      { error: "REASON_REQUIRED", message: "Say why it's free, so the order history explains it." },
      { status: 400 },
    );
  }

  const targets = body?.itemId ? order.items.filter((i) => i.id === body.itemId) : order.items;
  if (targets.length === 0) {
    return NextResponse.json(
      { error: body?.itemId ? "Item not found" : "EMPTY_ORDER", message: "Add an item first." },
      { status: body?.itemId ? 404 : 400 },
    );
  }

  await prisma.$transaction([
    ...targets.map((item) => {
      const lineCents = item.unitPriceCents * item.quantity;
      return prisma.posOrderItem.update({
        where: { id: item.id },
        data: {
          discountCents: lineCents,
          totalCents: 0,
          metadata: { ...metadataObject(item.metadata), manualDiscountCents: lineCents, freeReason: reason },
        },
      });
    }),
    prisma.posOrder.update({
      where: { id },
      data: {
        note: [
          order.note,
          body?.itemId ? `Free (${targets[0].name}): ${reason}` : `Free order: ${reason}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    }),
  ]);

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);
  return NextResponse.json({ ...updatedOrder, taxWarning });
}
