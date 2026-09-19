import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { POS_ORDER_INCLUDE, recalculateOrderTotals, repriceOrder } from "@/lib/pos";
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
      ...POS_ORDER_INCLUDE,
      staff: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: {
      items: { select: { itemType: true, category: true } },
      payments: { select: { status: true } },
      discounts: { select: { discountCode: { select: { maxUsesPerCustomerPerYear: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    customerId?: string | null;
    note?: string | null;
    tipCents?: number;
    walkInName?: string | null;
    walkInPhone?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Prisma.PosOrderUpdateInput = {};
  let customerChanged = false;
  if (body.customerId !== undefined && body.customerId !== order.customerId) {
    // A drop-in books its seat for whoever is on the order, a class pack puts
    // credits on their account, and member and per-customer discounts were
    // priced for them. Once money has been taken, swapping the customer would
    // give those to someone who didn't pay for them.
    const tiedToCustomer =
      order.items.some((i) => i.itemType === "DROP_IN" || i.category === "CLASS_PACK") ||
      order.discounts.length > 0;
    const hasPayment = order.payments.some((p) => p.status === "SUCCEEDED" || p.status === "PENDING");
    if (tiedToCustomer && hasPayment) {
      return NextResponse.json(
        {
          error: "CUSTOMER_LOCKED",
          message:
            "This order is tied to its customer (a class seat, a class pack or a discount) and already has a payment, so the customer can't be changed.",
        },
        { status: 409 },
      );
    }
    if (body.customerId) {
      const customer = await prisma.user.findUnique({ where: { id: body.customerId }, select: { id: true } });
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    data.customer = body.customerId ? { connect: { id: body.customerId } } : { disconnect: true };
    customerChanged = true;
  }
  if (body.walkInName !== undefined) data.walkInName = body.walkInName?.trim() || null;
  if (body.walkInPhone !== undefined) data.walkInPhone = body.walkInPhone?.trim() || null;
  if (body.note !== undefined) {
    data.note = body.note;
  }

  if (Object.keys(data).length > 0) {
    await prisma.posOrder.update({ where: { id }, data });
  }

  const tipCents =
    body.tipCents !== undefined ? Math.max(0, Math.floor(body.tipCents)) : undefined;

  // Who the customer is decides the automatic member discount, so a change of
  // customer reprices the whole order (discounts, then tax).
  let taxWarning: string | null = null;
  if (customerChanged) {
    ({ taxWarning } = await repriceOrder(id));
  }
  const updatedOrder = await recalculateOrderTotals(id, tipCents);

  return NextResponse.json({ ...updatedOrder, taxWarning });
}
