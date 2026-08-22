import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { formatMoney, maybeCompletePosOrder, remainingBalanceCents } from "@/lib/pos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { payments: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    amountCents?: number;
    cashTenderedCents?: number;
  } | null;

  if (!body?.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "amountCents is required and must be positive" }, { status: 400 });
  }
  if (!body.cashTenderedCents || body.cashTenderedCents <= 0) {
    return NextResponse.json({ error: "cashTenderedCents is required and must be positive" }, { status: 400 });
  }
  if (body.cashTenderedCents < body.amountCents) {
    return NextResponse.json({ error: "Cash tendered is less than the amount due" }, { status: 400 });
  }

  const remaining = remainingBalanceCents(order, order.payments);
  if (body.amountCents > remaining) {
    return NextResponse.json(
      { error: `amountCents cannot exceed the remaining balance of ${formatMoney(remaining)}` },
      { status: 400 },
    );
  }

  const changeCents = Math.max(0, body.cashTenderedCents - body.amountCents);

  await prisma.posPayment.create({
    data: {
      orderId: id,
      method: "CASH",
      amountCents: body.amountCents,
      status: "SUCCEEDED",
      cashTenderedCents: body.cashTenderedCents,
      cashChangeCents: changeCents,
    },
  });

  const updatedOrder = await maybeCompletePosOrder(id);

  return NextResponse.json({ order: updatedOrder, changeCents });
}
