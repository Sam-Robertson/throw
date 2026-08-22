import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { recalculateOrderTotals } from "@/lib/pos";
import type { Prisma } from "@prisma/client";

const ITEM_TYPES = ["RETAIL", "DROP_IN", "MEMBERSHIP", "GIFT_CARD", "CUSTOM"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

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
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    itemType?: string;
    refId?: string;
    name?: string;
    quantity?: number;
    unitPriceCents?: number;
    metadata?: unknown;
  } | null;

  if (!body?.itemType || !ITEM_TYPES.includes(body.itemType as ItemType)) {
    return NextResponse.json(
      { error: `itemType must be one of ${ITEM_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const itemType = body.itemType as ItemType;
  const quantity = body.quantity && body.quantity > 0 ? Math.floor(body.quantity) : 1;

  let name: string;
  let unitPriceCents: number;
  let refId: string | null = body.refId ?? null;

  if (itemType === "RETAIL") {
    if (!body.refId) {
      return NextResponse.json({ error: "refId is required for RETAIL items" }, { status: 400 });
    }
    const product = await prisma.retailProduct.findUnique({ where: { id: body.refId } });
    if (!product) return NextResponse.json({ error: "Retail product not found" }, { status: 404 });
    if (!product.isActive) {
      return NextResponse.json({ error: "Product is not active" }, { status: 409 });
    }
    if (quantity > product.inventory) {
      return NextResponse.json(
        { error: `Only ${product.inventory} in stock` },
        { status: 409 },
      );
    }
    name = product.name;
    unitPriceCents = product.priceCents;
  } else if (itemType === "DROP_IN") {
    if (!body.refId) {
      return NextResponse.json({ error: "refId is required for DROP_IN items" }, { status: 400 });
    }
    const sessionType = await prisma.sessionType.findUnique({ where: { id: body.refId } });
    if (!sessionType) return NextResponse.json({ error: "Session type not found" }, { status: 404 });
    name = sessionType.name;
    unitPriceCents = sessionType.dropInPriceCents;
  } else if (itemType === "MEMBERSHIP") {
    if (!body.refId) {
      return NextResponse.json({ error: "refId is required for MEMBERSHIP items" }, { status: 400 });
    }
    const plan = await prisma.membershipPlan.findUnique({ where: { id: body.refId } });
    if (!plan) return NextResponse.json({ error: "Membership plan not found" }, { status: 404 });
    name = plan.name;
    unitPriceCents = plan.price;
  } else if (itemType === "GIFT_CARD") {
    if (body.unitPriceCents === undefined) {
      return NextResponse.json(
        { error: "unitPriceCents is required for GIFT_CARD items" },
        { status: 400 },
      );
    }
    name = "Gift Card";
    unitPriceCents = body.unitPriceCents;
    refId = null;
  } else {
    // CUSTOM
    if (!body.name || body.unitPriceCents === undefined) {
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
      metadata: (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  const updatedOrder = await recalculateOrderTotals(id);

  return NextResponse.json(updatedOrder, { status: 201 });
}
