import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import {
  GROUP_EVENT_LOOKBACK_DAYS,
  GROUP_EVENT_NOTE_PREFIX,
  GROUP_EVENT_SESSION_TYPE,
  refuseDiscount,
  repriceOrder,
} from "@/lib/pos";
import { formatMountainTime } from "@/lib/timezone";

/**
 * Puts a named discount on an open order: staff-applied discounts by
 * `discountCodeId` (from the catalog's `staffDiscounts`) or any discount by its
 * `code`. Automatic member discounts are never added here — repriceOrder
 * attaches them from the customer's membership.
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

  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: { payments: { select: { status: true } }, discounts: { select: { discountCodeId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }
  if (order.payments.some((p) => p.status === "SUCCEEDED" || p.status === "PENDING")) {
    return NextResponse.json(
      {
        error: "PAYMENT_STARTED",
        message: "This order already has a payment, so its discounts can't change. Remove the payment first.",
      },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    discountCodeId?: string;
    code?: string;
    note?: string;
    groupEventSessionId?: string;
  } | null;

  const code = body?.code?.trim().toUpperCase();
  if (!body || (!body.discountCodeId && !code)) {
    return NextResponse.json({ error: "discountCodeId or code is required" }, { status: 400 });
  }

  const discount = body.discountCodeId
    ? await prisma.discountCode.findUnique({ where: { id: body.discountCodeId } })
    : await prisma.discountCode.findUnique({ where: { code: code! } });
  if (!discount) {
    return NextResponse.json(
      { error: "DISCOUNT_NOT_FOUND", message: "No discount with that code." },
      { status: 404 },
    );
  }
  if (discount.appliesVia === "AUTOMATIC") {
    return NextResponse.json(
      {
        error: "DISCOUNT_AUTOMATIC",
        message: `${discount.name ?? discount.code} applies on its own when the member is on the order.`,
      },
      { status: 400 },
    );
  }
  if (order.discounts.some((d) => d.discountCodeId === discount.id)) {
    return NextResponse.json(
      { error: "ALREADY_APPLIED", message: "That discount is already on this order." },
      { status: 409 },
    );
  }

  // "Only on orders tied to a group event": staff pick the event, and it is
  // checked here — a recent group event at this studio.
  let note = body.note?.trim() ? body.note.trim().slice(0, 500) : null;
  let isGroupEventOrder = false;
  if (discount.requiresGroupEvent && body.groupEventSessionId) {
    const since = new Date(Date.now() - GROUP_EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const groupEvent = await prisma.studioSession.findFirst({
      where: {
        id: body.groupEventSessionId,
        locationId: order.locationId,
        isCancelled: false,
        startsAt: { gte: since },
        sessionType: GROUP_EVENT_SESSION_TYPE,
      },
      include: { sessionType: { select: { name: true } } },
    });
    if (!groupEvent) {
      return NextResponse.json(
        {
          error: "GROUP_EVENT_NOT_FOUND",
          message: `That isn't a group event at this studio in the last ${GROUP_EVENT_LOOKBACK_DAYS} days.`,
        },
        { status: 400 },
      );
    }
    isGroupEventOrder = true;
    const label = `${groupEvent.title ?? groupEvent.sessionType.name}, ${formatMountainTime(groupEvent.startsAt, "datetime")} [${groupEvent.id}]`;
    note = `${GROUP_EVENT_NOTE_PREFIX}${label}${note ? ` — ${note}` : ""}`;
  }

  const refusal = await refuseDiscount(discount, {
    locationId: order.locationId,
    customerId: order.customerId,
    note,
    isGroupEventOrder,
  });
  if (refusal) {
    const status = ["CUSTOMER_REQUIRED", "NOTE_REQUIRED", "GROUP_EVENT_REQUIRED"].includes(refusal.error) ? 400 : 409;
    return NextResponse.json(refusal, { status });
  }

  const applied = await prisma.posOrderDiscount.create({
    data: {
      orderId: id,
      discountCodeId: discount.id,
      name: discount.name ?? discount.code,
      note,
      appliedById: session.user.id,
    },
  });

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  // Kept on the order even at $0: the line it is for may not be rung up yet.
  const amountCents = updatedOrder.discounts.find((d) => d.id === applied.id)?.amountCents ?? 0;
  const discountWarning =
    amountCents === 0 ? `Nothing on this order qualifies for ${applied.name} yet, so it isn't taking anything off.` : null;

  return NextResponse.json({ ...updatedOrder, taxWarning, discountWarning }, { status: 201 });
}
