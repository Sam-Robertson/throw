import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scopeAllowsUnassigned } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { NOT_VISIBLE } from "../../_lib/planQuery";

/**
 * Plans are never deleted: memberships, payments and history point at them.
 * Archiving takes a plan off sale and out of the default admin list. Members
 * already on it are not touched. `{ archived: false }` restores the row, still
 * inactive, so it has to be switched back on deliberately.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { archived?: unknown } | null;
  const archived = body?.archived !== false;

  const current = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, current.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  const plan = await prisma.membershipPlan.update({
    where: { id },
    data: archived
      ? { isActive: false, archivedAt: current.archivedAt ?? new Date() }
      : { archivedAt: null },
  });

  return NextResponse.json(plan);
}
