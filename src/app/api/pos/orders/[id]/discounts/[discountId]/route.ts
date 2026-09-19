import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { repriceOrder } from "@/lib/pos";

/** Takes a named discount off an open order. `discountId` is the PosOrderDiscount id. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; discountId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, discountId } = await params;

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: { payments: { select: { status: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
        message: "This order already has a payment, so its discounts can't change. Remove the payment first.",
      },
      { status: 409 },
    );
  }

  const applied = await prisma.posOrderDiscount.findUnique({ where: { id: discountId } });
  if (!applied || applied.orderId !== id) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }
  if (applied.automatic) {
    // repriceOrder would put it straight back.
    return NextResponse.json(
      {
        error: "DISCOUNT_AUTOMATIC",
        message: `${applied.name} comes with this customer's membership. Remove the customer to take it off.`,
      },
      { status: 400 },
    );
  }

  await prisma.posOrderDiscount.delete({ where: { id: discountId } });

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  return NextResponse.json({ ...updatedOrder, taxWarning });
}
