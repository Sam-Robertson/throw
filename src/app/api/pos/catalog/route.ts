import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function locationScope(locationId: string | null) {
  if (!locationId) return {};
  return { OR: [{ locationId }, { locationId: null }] };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const scope = locationScope(locationId);

  const [retailProducts, sessionTypes, membershipPlans] = await Promise.all([
    prisma.retailProduct.findMany({
      where: { isActive: true, ...scope },
      select: { id: true, name: true, priceCents: true, inventory: true },
      orderBy: { name: "asc" },
    }),
    prisma.sessionType.findMany({
      where: { isActive: true, ...scope },
      select: { id: true, name: true, dropInPriceCents: true },
      orderBy: { name: "asc" },
    }),
    prisma.membershipPlan.findMany({
      where: { isActive: true, ...scope },
      select: { id: true, name: true, price: true, billingIntervalDays: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    retailProducts: retailProducts.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      stock: p.inventory,
    })),
    sessionTypes: sessionTypes.map((s) => ({
      id: s.id,
      name: s.name,
      dropInPriceCents: s.dropInPriceCents,
    })),
    membershipPlans: membershipPlans.map((m) => ({
      id: m.id,
      name: m.name,
      priceInCents: m.price,
      billingIntervalDays: m.billingIntervalDays,
    })),
  });
}
