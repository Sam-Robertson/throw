import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { POS_ORDER_INCLUDE } from "@/lib/pos";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, paymentId } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payment = await prisma.posPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.orderId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedToDelete = payment.status === "PENDING" || order.status === "OPEN";
  if (!allowedToDelete) {
    return NextResponse.json({ error: "This payment can no longer be removed" }, { status: 409 });
  }

  if (payment.method === "CARD_MANUAL" && payment.status === "SUCCEEDED") {
    return NextResponse.json(
      { error: "This card payment has already succeeded. Use the refund flow instead." },
      { status: 409 },
    );
  }

  if (payment.method === "GIFT_CARD" && payment.giftCardId && payment.status === "SUCCEEDED") {
    await prisma.giftCard.update({
      where: { id: payment.giftCardId },
      data: { balanceCents: { increment: payment.amountCents } },
    });
  }

  // Account credit goes back to the customer it came from (externalRef).
  if (payment.method === "ACCOUNT_CREDIT" && payment.externalRef && payment.status === "SUCCEEDED") {
    await prisma.user.update({
      where: { id: payment.externalRef },
      data: { accountCreditCents: { increment: payment.amountCents } },
    });
  }

  await prisma.posPayment.delete({ where: { id: paymentId } });

  const updatedOrder = await prisma.posOrder.findUnique({
    where: { id },
    include: POS_ORDER_INCLUDE,
  });

  return NextResponse.json(updatedOrder);
}
