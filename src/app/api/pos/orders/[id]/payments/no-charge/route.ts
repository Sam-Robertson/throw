import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { checkOrderPayable, maybeCompletePosOrder, remainingBalanceCents } from "@/lib/pos";

/**
 * Completes an order that has nothing left to pay: a $0 line (bisque firing),
 * or discounts that cover everything. No PosPayment is created; the same
 * prechecks and completion side effects run as for any tender.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { payments: true, items: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }
  if (order.items.length === 0) {
    return NextResponse.json(
      { error: "EMPTY_ORDER", message: "Add an item before completing the order." },
      { status: 400 },
    );
  }

  const block = await checkOrderPayable(id);
  if (block) {
    return NextResponse.json({ error: block.error, message: block.message }, { status: block.status });
  }

  if (remainingBalanceCents(order, order.payments) > 0) {
    return NextResponse.json(
      { error: "BALANCE_DUE", message: "This order still has a balance to pay." },
      { status: 409 },
    );
  }

  const updatedOrder = await maybeCompletePosOrder(id);
  return NextResponse.json({ order: updatedOrder });
}
