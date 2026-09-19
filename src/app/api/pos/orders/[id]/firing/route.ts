import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import {
  MEMBERS_ONLY_MESSAGE,
  MEMBER_FIRING_KIND,
  getFiringProducts,
  isMemberOrEnrolledStudent,
  repriceOrder,
} from "@/lib/pos";
import { formatWeightLb, quoteMemberFiring, type FiringPieceInput } from "@/lib/firing";
import { taxCodeForPosItem } from "@/config/taxCodes";

const MAX_PIECES = 50;

/**
 * Member glaze firing: prices a list of weighed pieces with src/lib/firing.ts
 * and adds one line per piece, so the per-piece minimum shows on the receipt.
 * Rates and the minimum come from the two firing products, never the client.
 * `dryRun: true` returns the quote without touching the order.
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

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "OPEN") {
    return NextResponse.json({ error: "Order is not open" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    pieces?: { weightLb?: unknown; oversize?: unknown; pieceId?: unknown; note?: unknown }[];
    dryRun?: boolean;
  } | null;
  if (!body || !Array.isArray(body.pieces) || body.pieces.length === 0) {
    return NextResponse.json({ error: "pieces is required: [{ weightLb, oversize }]" }, { status: 400 });
  }
  if (body.pieces.length > MAX_PIECES) {
    return NextResponse.json({ error: `At most ${MAX_PIECES} pieces at a time` }, { status: 400 });
  }

  const firing = await getFiringProducts();
  if (!firing) {
    return NextResponse.json(
      {
        error: "FIRING_NOT_CONFIGURED",
        message: "The glaze firing products are missing or inactive. Check Studio Set-up > Products.",
      },
      { status: 409 },
    );
  }

  // Only members and enrolled students may use member firing.
  if (!(await isMemberOrEnrolledStudent(order.customerId))) {
    return NextResponse.json({ error: "MEMBERS_ONLY", message: MEMBERS_ONLY_MESSAGE }, { status: 403 });
  }

  const pieces: FiringPieceInput[] = body.pieces.map((p) => ({
    weightLb: p?.weightLb as number,
    oversize: p?.oversize === true,
  }));
  const quote = quoteMemberFiring(pieces, firing.rates);
  if (!quote.ok) {
    return NextResponse.json(
      { error: "INVALID_WEIGHT", message: quote.reason, pieceIndex: quote.pieceIndex },
      { status: 400 },
    );
  }

  if (body.dryRun) {
    return NextResponse.json({ quote, rates: firing.rates });
  }

  // One create per piece, in order: lines sort by createdAt, and a single
  // createMany would give every piece the same timestamp.
  for (const line of quote.lines) {
    const product = line.oversize ? firing.oversize : firing.standard;
    const source = body.pieces[line.index];
    await prisma.posOrderItem.create({
      data: {
        orderId: id,
        itemType: "RETAIL",
        refId: product.id,
        name: `${product.name}, ${formatWeightLb(line.weightTenths)}`,
        quantity: 1,
        unitPriceCents: line.chargeCents,
        discountCents: 0,
        totalCents: line.chargeCents,
        taxCode: taxCodeForPosItem("RETAIL", product),
        category: product.category,
        note: typeof source?.note === "string" && source.note.trim() ? source.note.trim().slice(0, 500) : null,
        metadata: {
          kind: MEMBER_FIRING_KIND,
          productSlug: product.slug,
          unit: "LB",
          membersOnly: true,
          weightLb: line.weightLb,
          weightTenths: line.weightTenths,
          oversize: line.oversize,
          rateCentsPerLb: line.rateCentsPerLb,
          minChargeCents: firing.rates.minChargeCents,
          minimumApplied: line.minimumApplied,
          ...(typeof source?.pieceId === "string" && source.pieceId ? { pieceId: source.pieceId } : {}),
        },
      },
    });
  }

  const { order: updatedOrder, taxWarning } = await repriceOrder(id);

  return NextResponse.json({ ...updatedOrder, taxWarning, quote }, { status: 201 });
}
