import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { POS_ORDER_INCLUDE, recalculateOrderTotals } from "@/lib/pos";
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
    include: { items: { select: { itemType: true } }, payments: { select: { status: true } } },
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
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Prisma.PosOrderUpdateInput = {};
  if (body.customerId !== undefined && body.customerId !== order.customerId) {
    // A drop-in books its seat for whoever is on the order. Once money has
    // been taken, swapping the customer would book someone who didn't pay.
    const hasDropIn = order.items.some((i) => i.itemType === "DROP_IN");
    const hasPayment = order.payments.some((p) => p.status === "SUCCEEDED" || p.status === "PENDING");
    if (hasDropIn && hasPayment) {
      return NextResponse.json(
        {
          error: "CUSTOMER_LOCKED",
          message:
            "This order books a class seat and already has a payment, so the customer can't be changed.",
        },
        { status: 409 },
      );
    }
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
