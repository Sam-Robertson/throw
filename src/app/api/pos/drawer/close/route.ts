import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { computeDrawerExpectedCash } from "@/lib/pos";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    countedCashCents?: number;
    note?: string;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (body.countedCashCents === undefined || body.countedCashCents < 0) {
    return NextResponse.json({ error: "countedCashCents is required and cannot be negative" }, { status: 400 });
  }

  const drawer = await prisma.posCashDrawer.findFirst({
    where: { locationId: body.locationId, closedAt: null },
  });
  if (!drawer) {
    return NextResponse.json({ error: "No open drawer for this location" }, { status: 404 });
  }

  const { expectedCashCents } = await computeDrawerExpectedCash(
    body.locationId,
    drawer.openedAt,
    drawer.openingFloatCents,
  );

  const varianceCents = body.countedCashCents - expectedCashCents;

  const closed = await prisma.posCashDrawer.update({
    where: { id: drawer.id },
    data: {
      closedAt: new Date(),
      closedById: session.user.id,
      expectedCashCents,
      countedCashCents: body.countedCashCents,
      varianceCents,
      note: body.note?.trim() || drawer.note,
    },
  });

  return NextResponse.json(closed);
}
