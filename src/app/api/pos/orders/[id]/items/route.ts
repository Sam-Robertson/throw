import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { MEMBERS_ONLY_MESSAGE, dropInSessionId, isMemberOrEnrolledStudent, repriceOrder } from "@/lib/pos";
import { formatWeightLb, priceByWeight } from "@/lib/firing";
import { CLASS_PRICE_SELECT, isSellable, resolveClassPriceCents } from "@/lib/sellable";
import { formatMountainTime } from "@/lib/timezone";
import { taxCodeForPosItem } from "@/config/taxCodes";
import { parseFiringMetadata, quoteFiring } from "@/config/firingPrices";
import type { Prisma } from "@prisma/client";

const ITEM_TYPES = ["RETAIL", "DROP_IN", "MEMBERSHIP", "GIFT_CARD", "CUSTOM"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    itemType?: string;
    refId?: string;
    name?: string;
    quantity?: number;
    unitPriceCents?: number;
    /** By-weight products (unit LB): the weight in pounds. */
    weightLb?: number;
    note?: string;
    metadata?: unknown;
  } | null;

  if (!body?.itemType || !ITEM_TYPES.includes(body.itemType as ItemType)) {
    return NextResponse.json(
      { error: `itemType must be one of ${ITEM_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const itemType = body.itemType as ItemType;
  let quantity = body.quantity && body.quantity > 0 ? Math.floor(body.quantity) : 1;

  let name: string;
  let unitPriceCents: number;
  let refId: string | null = body.refId ?? null;
  let metadata = (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined;
  let category: string | null = null;
  let taxCode = taxCodeForPosItem(itemType);

  if (itemType === "RETAIL") {
    if (!body.refId) {
      return NextResponse.json({ error: "refId is required for RETAIL items" }, { status: 400 });
    }
    const product = await prisma.retailProduct.findUnique({ where: { id: body.refId } });
    if (!product) return NextResponse.json({ error: "Retail product not found" }, { status: 404 });
    if (!product.isActive || product.archivedAt) {
      return NextResponse.json({ error: "Product is not active" }, { status: 409 });
    }
    // OPEN in the catalog: there is no price to charge yet.
    if (!product.isPriced) {
      return NextResponse.json(
        { error: "NOT_PRICED", message: `${product.name} doesn't have a price yet.` },
        { status: 409 },
      );
    }
    if (product.locationId && product.locationId !== order.locationId) {
      return NextResponse.json(
        { error: "WRONG_LOCATION", message: "That product is sold at a different studio." },
        { status: 400 },
      );
    }
    if (product.membersOnly && !(await isMemberOrEnrolledStudent(order.customerId))) {
      return NextResponse.json({ error: "MEMBERS_ONLY", message: MEMBERS_ONLY_MESSAGE }, { status: 403 });
    }
    if (product.category === "CLASS_PACK" && !order.customerId) {
      return NextResponse.json(
        {
          error: "CUSTOMER_REQUIRED",
          message: "Class pack credits go on a customer's account. Attach the customer first.",
        },
        { status: 400 },
      );
    }

    const productMeta = {
      productSlug: product.slug,
      unit: product.unit,
      ...(product.membersOnly ? { membersOnly: true } : {}),
      ...(product.classCredits ? { classCredits: product.classCredits } : {}),
    };

    if (product.unit === "LB") {
      // Sold by weight: the line is priced here from the weight (to 0.1 lb)
      // and the product's rate and minimum, and can't be multiplied.
      if (typeof body.weightLb !== "number") {
        return NextResponse.json(
          { error: "WEIGHT_REQUIRED", message: `${product.name} is sold by the pound. Enter the weight.` },
          { status: 400 },
        );
      }
      const priced = priceByWeight(body.weightLb, product.priceCents, product.minChargeCents);
      if (!priced.ok) {
        return NextResponse.json({ error: "INVALID_WEIGHT", message: priced.reason }, { status: 400 });
      }
      name = `${product.name}, ${formatWeightLb(priced.weightTenths)}`;
      unitPriceCents = priced.cents;
      quantity = 1;
      metadata = {
        ...productMeta,
        weightLb: priced.weightLb,
        weightTenths: priced.weightTenths,
        rateCentsPerLb: product.priceCents,
      };
    } else {
      if (product.trackInventory && quantity > product.inventory) {
        return NextResponse.json(
          { error: `Only ${product.inventory} in stock` },
          { status: 409 },
        );
      }
      name = product.name;
      unitPriceCents = product.priceCents;
      metadata = productMeta;
    }
    category = product.category;
    taxCode = taxCodeForPosItem(itemType, product);
  } else if (itemType === "DROP_IN") {
    // A drop-in is one seat in one real session, booked for the order's
    // customer when the order completes.
    const studioSessionId = asObject(body.metadata).studioSessionId;
    if (typeof studioSessionId !== "string" || !studioSessionId) {
      return NextResponse.json(
        { error: "SESSION_REQUIRED", message: "Pick the class session this drop-in is for." },
        { status: 400 },
      );
    }
    const studioSession = await prisma.studioSession.findUnique({
      where: { id: studioSessionId },
      include: {
        sessionType: { select: { ...CLASS_PRICE_SELECT, name: true } },
        _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
      },
    });
    if (!studioSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (studioSession.locationId !== order.locationId) {
      return NextResponse.json(
        { error: "WRONG_LOCATION", message: "That session is at a different studio." },
        { status: 400 },
      );
    }
    if (studioSession.isCancelled) {
      return NextResponse.json(
        { error: "SESSION_CANCELLED", message: "That session has been cancelled." },
        { status: 409 },
      );
    }
    const classPriceCents = resolveClassPriceCents({
      sessionType: studioSession.sessionType,
      locationId: studioSession.locationId,
      priceCentsOverride: studioSession.priceCentsOverride,
    });
    if (!isSellable(studioSession.sessionType, classPriceCents)) {
      return NextResponse.json(
        { error: "NOT_FOR_SALE", message: `${studioSession.sessionType.name} isn't sold as a drop-in.` },
        { status: 400 },
      );
    }

    const existingDropIns = await prisma.posOrderItem.findMany({
      where: { orderId: id, itemType: "DROP_IN" },
      select: { metadata: true },
    });
    if (existingDropIns.some((i) => dropInSessionId(i.metadata) === studioSessionId)) {
      return NextResponse.json(
        {
          error: "ALREADY_IN_ORDER",
          message: "That session is already in this order. A drop-in is one seat for the order's customer.",
        },
        { status: 409 },
      );
    }
    if (studioSession._count.bookings >= studioSession.capacity) {
      return NextResponse.json(
        { error: "SESSION_FULL", message: `${studioSession.sessionType.name} is full.` },
        { status: 409 },
      );
    }
    if (order.customerId) {
      const booked = await prisma.booking.findFirst({
        where: { userId: order.customerId, studioSessionId, status: { not: "CANCELLED" } },
        select: { id: true },
      });
      if (booked) {
        return NextResponse.json(
          { error: "ALREADY_BOOKED", message: "This customer is already booked into that session." },
          { status: 409 },
        );
      }
    }

    name = `${studioSession.sessionType.name}, ${formatMountainTime(studioSession.startsAt, "datetime")}`;
    unitPriceCents = classPriceCents;
    refId = studioSession.sessionTypeId;
    quantity = 1;
    metadata = { studioSessionId, startsAt: studioSession.startsAt.toISOString() };
  } else if (itemType === "MEMBERSHIP") {
    // Not offered in the terminal UI (memberships are online-only until
    // Oct 25); kept so existing clients and orders keep working.
    if (!body.refId) {
      return NextResponse.json({ error: "refId is required for MEMBERSHIP items" }, { status: 400 });
    }
    const plan = await prisma.membershipPlan.findUnique({ where: { id: body.refId } });
    if (!plan) return NextResponse.json({ error: "Membership plan not found" }, { status: 404 });
    name = plan.name;
    unitPriceCents = plan.price;
  } else if (itemType === "GIFT_CARD") {
    if (!isNonNegativeInt(body.unitPriceCents) || body.unitPriceCents === 0) {
      return NextResponse.json(
        { error: "unitPriceCents is required for GIFT_CARD items and must be positive" },
        { status: 400 },
      );
    }
    name = "Gift Card";
    unitPriceCents = body.unitPriceCents;
    refId = null;
  } else if (asObject(body.metadata).kind === "FIRING") {
    // Clay & firing line: the price is recomputed here from the weight and
    // tier, never taken from the client.
    const firing = parseFiringMetadata(body.metadata);
    if (!firing) {
      return NextResponse.json({ error: "Invalid clay & firing details" }, { status: 400 });
    }
    const quote = quoteFiring(firing);
    if (!quote.ok) return NextResponse.json({ error: quote.reason }, { status: 400 });

    name = quote.name;
    unitPriceCents = quote.totalCents;
    refId = null;
    quantity = 1;
    metadata = {
      kind: firing.kind,
      tier: firing.tier,
      weightOz: firing.weightOz,
      count: firing.count,
      ...(firing.pieceIds ? { pieceIds: firing.pieceIds } : {}),
    };
  } else {
    // CUSTOM
    if (!body.name || !isNonNegativeInt(body.unitPriceCents)) {
      return NextResponse.json(
        { error: "name and unitPriceCents are required for CUSTOM items" },
        { status: 400 },
      );
    }
    name = body.name;
    unitPriceCents = body.unitPriceCents;
    refId = null;
  }

  const totalCents = unitPriceCents * quantity;

  await prisma.posOrderItem.create({
    data: {
      orderId: id,
      itemType,
      refId,
      name,
      quantity,
      unitPriceCents,
      discountCents: 0,
      totalCents,
      taxCode,
      category,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
      metadata,
    },
  });

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  return NextResponse.json({ ...updatedOrder, taxWarning }, { status: 201 });
}
