import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { maybeCompletePosOrder, remainingBalanceCents } from "@/lib/pos";

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
    code?: string;
    amountCents?: number;
  } | null;

  if (!body?.code?.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (!body.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "amountCents is required and must be positive" }, { status: 400 });
  }

  const giftCard = await prisma.giftCard.findUnique({ where: { code: body.code.trim().toUpperCase() } });
  if (!giftCard) {
    return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
  }
  if (!giftCard.isActive) {
    return NextResponse.json({ error: "This gift card is inactive" }, { status: 409 });
  }
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    return NextResponse.json({ error: "This gift card has expired" }, { status: 409 });
  }
  if (giftCard.balanceCents <= 0) {
    return NextResponse.json({ error: "This gift card has no remaining balance" }, { status: 409 });
  }

  const remaining = remainingBalanceCents(order, order.payments);
  const amountApplied = Math.min(body.amountCents, remaining, giftCard.balanceCents);
  if (amountApplied <= 0) {
    return NextResponse.json({ error: "There is no remaining balance to charge" }, { status: 400 });
  }

  await prisma.giftCard.update({
    where: { id: giftCard.id },
    data: { balanceCents: { decrement: amountApplied } },
  });

  await prisma.posPayment.create({
    data: {
      orderId: id,
      method: "GIFT_CARD",
      amountCents: amountApplied,
      status: "SUCCEEDED",
      giftCardId: giftCard.id,
    },
  });

  const updatedOrder = await maybeCompletePosOrder(id);

  return NextResponse.json({
    order: updatedOrder,
    amountApplied,
    giftCardRemainingCents: giftCard.balanceCents - amountApplied,
  });
}
