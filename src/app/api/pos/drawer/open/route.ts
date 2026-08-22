import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    openingFloatCents?: number;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (body.openingFloatCents === undefined || body.openingFloatCents < 0) {
    return NextResponse.json({ error: "openingFloatCents is required and cannot be negative" }, { status: 400 });
  }

  const existing = await prisma.posCashDrawer.findFirst({
    where: { locationId: body.locationId, closedAt: null },
  });
  if (existing) {
    return NextResponse.json({ error: "A drawer is already open for this location" }, { status: 409 });
  }

  const drawer = await prisma.posCashDrawer.create({
    data: {
      locationId: body.locationId,
      openedById: session.user.id,
      openingFloatCents: body.openingFloatCents,
    },
  });

  return NextResponse.json(drawer, { status: 201 });
}
