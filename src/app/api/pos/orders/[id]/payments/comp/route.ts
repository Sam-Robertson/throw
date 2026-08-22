import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, maybeCompletePosOrder, remainingBalanceCents } from "@/lib/pos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { payments: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    amountCents?: number;
    reason?: string;
  } | null;

  if (!body?.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "amountCents is required and must be positive" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const remaining = remainingBalanceCents(order, order.payments);
  if (body.amountCents > remaining) {
    return NextResponse.json(
      { error: `amountCents cannot exceed the remaining balance of ${formatMoney(remaining)}` },
      { status: 400 },
    );
  }

  await prisma.posPayment.create({
    data: {
      orderId: id,
      method: "COMP",
      amountCents: body.amountCents,
      status: "SUCCEEDED",
    },
  });

  const reason = body.reason.trim();
  const newNote = order.note ? `${order.note}\nComp: ${reason}` : `Comp: ${reason}`;
  await prisma.posOrder.update({ where: { id }, data: { note: newNote } });

  const updatedOrder = await maybeCompletePosOrder(id);

  return NextResponse.json({ order: updatedOrder });
}
