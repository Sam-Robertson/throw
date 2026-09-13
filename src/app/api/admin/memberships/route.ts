import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { membershipScopeWhere, requireStaffScope } from "@/lib/staffScope";

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  // Membership or plan location in scope; location-less memberships (the
  // Momence imports) are visible to every studio — see membershipScopeWhere.
  const memberships = await prisma.membership.findMany({
    where: membershipScopeWhere(guard.scope),
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true } },
    },
  });

  return NextResponse.json(memberships);
}
