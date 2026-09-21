import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { sendInngestEvent } from "@/lib/inngest";
import { POS_ORDER_INCLUDE, courseBookingIds, reverseCompletionSideEffects } from "@/lib/pos";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Every void says why: it is what the owner reads in the order history.
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) {
    return NextResponse.json(
      { error: "REASON_REQUIRED", message: "Say why this order is being voided." },
      { status: 400 },
    );
  }

  const isAdmin = session.user.role === "ADMIN";
  const withinGracePeriod =
    order.status === "COMPLETED" &&
    order.completedAt !== null &&
    Date.now() - order.completedAt.getTime() <= GRACE_PERIOD_MS;

  const canVoid = order.status === "OPEN" || (withinGracePeriod && isAdmin);
  if (!canVoid) {
    return NextResponse.json(
      {
        error:
          "Only open orders, or completed orders within 24 hours and voided by an admin, can be voided",
      },
      { status: 409 },
    );
  }

  await prisma.posOrder.update({
    where: { id },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidReason: reason,
    },
  });

  // Stored-value tenders are ours to give back, so a void returns them on the
  // spot: gift card balances and account credit. The payment row is kept and
  // marked REFUNDED. (Card payments are not refunded here — that's still a
  // separate step in Stripe.)
  const storedValuePayments = await prisma.posPayment.findMany({
    where: { orderId: id, status: "SUCCEEDED", method: { in: ["GIFT_CARD", "ACCOUNT_CREDIT"] } },
  });
  for (const payment of storedValuePayments) {
    // The status flip is the guard: whoever flips it does the restore, once.
    const { count } = await prisma.posPayment.updateMany({
      where: { id: payment.id, status: "SUCCEEDED" },
      data: { status: "REFUNDED" },
    });
    if (count === 0) continue;
    if (payment.method === "GIFT_CARD" && payment.giftCardId) {
      await prisma.giftCard.update({
        where: { id: payment.giftCardId },
        data: { balanceCents: { increment: payment.amountCents } },
      });
    } else if (payment.method === "ACCOUNT_CREDIT" && payment.externalRef) {
      await prisma.user.update({
        where: { id: payment.externalRef },
        data: { accountCreditCents: { increment: payment.amountCents } },
      });
    }
  }

  // Class pack credits come back off the customer and discount uses are released.
  if (order.status === "COMPLETED") {
    await reverseCompletionSideEffects(id);
  }

  const updated = await prisma.posOrder.findUniqueOrThrow({ where: { id }, include: POS_ORDER_INCLUDE });

  // A completed order may have booked class seats; voiding the sale frees
  // them, including every later session a course line booked. (Money is not
  // refunded here — that's still a separate step.)
  if (order.status === "COMPLETED") {
    const dropIns = updated.items.filter((i) => i.itemType === "DROP_IN");
    const itemIds = dropIns.map((i) => i.id);
    const laterCourseBookingIds = dropIns.flatMap((i) => courseBookingIds(i.metadata));
    if (itemIds.length > 0) {
      const bookings = await prisma.booking.findMany({
        where: {
          OR: [{ posOrderItemId: { in: itemIds } }, { id: { in: laterCourseBookingIds } }],
          status: { not: "CANCELLED" },
        },
        select: { id: true, userId: true, studioSessionId: true },
      });
      for (const booking of bookings) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        await sendInngestEvent({
          name: "booking/cancelled",
          data: {
            bookingId: booking.id,
            userId: booking.userId,
            studioSessionId: booking.studioSessionId,
          },
        });
      }
    }
  }

  return NextResponse.json(updated);
}
