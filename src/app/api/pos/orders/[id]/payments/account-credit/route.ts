import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { checkOrderPayable, maybeCompletePosOrder, remainingBalanceCents } from "@/lib/pos";

/**
 * Pays with the attached customer's account credit (User.accountCreditCents).
 * Mirrors the gift card tender: applies up to the amount asked, the balance
 * owed and the credit available. The payment's externalRef is the customer it
 * came from, so removing the payment (or voiding the order) can put it back.
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

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { payments: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const block = await checkOrderPayable(id);
  if (block) {
    return NextResponse.json({ error: block.error, message: block.message }, { status: block.status });
  }

  if (!order.customerId) {
    return NextResponse.json(
      { error: "CUSTOMER_REQUIRED", message: "Attach the customer whose account credit is being used." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as { amountCents?: number } | null;
  if (!body?.amountCents || !Number.isInteger(body.amountCents) || body.amountCents <= 0) {
    return NextResponse.json({ error: "amountCents is required and must be a positive whole number" }, { status: 400 });
  }

  const customer = await prisma.user.findUnique({
    where: { id: order.customerId },
    select: { accountCreditCents: true },
  });
  if (!customer || customer.accountCreditCents <= 0) {
    return NextResponse.json(
      { error: "NO_ACCOUNT_CREDIT", message: "This customer has no account credit." },
      { status: 409 },
    );
  }

  const remaining = remainingBalanceCents(order, order.payments);
  const amountApplied = Math.min(body.amountCents, remaining, customer.accountCreditCents);
  if (amountApplied <= 0) {
    return NextResponse.json({ error: "There is no remaining balance to charge" }, { status: 400 });
  }

  // Atomic: the decrement only happens if the credit is still there, so two
  // registers can't spend the same credit and it can never go negative.
  const { count } = await prisma.user.updateMany({
    where: { id: order.customerId, accountCreditCents: { gte: amountApplied } },
    data: { accountCreditCents: { decrement: amountApplied } },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: "NO_ACCOUNT_CREDIT", message: "This customer's account credit just changed. Check the balance and try again." },
      { status: 409 },
    );
  }

  await prisma.posPayment.create({
    data: {
      orderId: id,
      method: "ACCOUNT_CREDIT",
      amountCents: amountApplied,
      status: "SUCCEEDED",
      externalRef: order.customerId,
    },
  });

  const updatedOrder = await maybeCompletePosOrder(id);

  return NextResponse.json({
    order: updatedOrder,
    amountApplied,
    accountCreditRemainingCents: customer.accountCreditCents - amountApplied,
  });
}
