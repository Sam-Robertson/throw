import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

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

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    include: { items: true, payments: true },
  });

  return NextResponse.json(updated);
}
