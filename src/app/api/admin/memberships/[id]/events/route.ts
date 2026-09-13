import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { membershipScopeWhere, requireStaffScope } from "@/lib/staffScope";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;

  const visible = await prisma.membership.count({
    where: { id, AND: [membershipScopeWhere(guard.scope)] },
  });
  if (visible === 0)
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });

  const events = await prisma.membershipEvent.findMany({
    where: { membershipId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(events);
}
