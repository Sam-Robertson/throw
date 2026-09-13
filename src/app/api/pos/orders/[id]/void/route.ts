import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { sendInngestEvent } from "@/lib/inngest";
import { POS_ORDER_INCLUDE } from "@/lib/pos";

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

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  if (!body?.reason?.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
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

  const updated = await prisma.posOrder.update({
    where: { id },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidReason: body.reason.trim(),
    },
    include: POS_ORDER_INCLUDE,
  });

  // A completed order may have booked drop-in seats; voiding the sale frees
  // them. (Money is not refunded here — that's still a separate step.)
  if (order.status === "COMPLETED") {
    const itemIds = order.items.filter((i) => i.itemType === "DROP_IN").map((i) => i.id);
    if (itemIds.length > 0) {
      const bookings = await prisma.booking.findMany({
        where: { posOrderItemId: { in: itemIds }, status: { not: "CANCELLED" } },
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
