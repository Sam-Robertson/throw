import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { computeDrawerExpectedCash } from "@/lib/pos";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const drawer = await prisma.posCashDrawer.findFirst({
    where: { locationId, closedAt: null },
    include: {
      openedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  if (!drawer) {
    return NextResponse.json({ drawer: null });
  }

  const { expectedCashCents, cashPaymentCount } = await computeDrawerExpectedCash(
    locationId,
    drawer.openedAt,
    drawer.openingFloatCents,
  );

  return NextResponse.json({ drawer, expectedCashCents, cashPaymentCount });
}
