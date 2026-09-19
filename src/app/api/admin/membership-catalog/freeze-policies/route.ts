import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locationWhere } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

// One entry per studio in scope. `policy` is null until one has been saved;
// null amounts inside a policy mean "not decided yet".
export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  const locations = await prisma.location.findMany({
    where: { isActive: true, ...locationWhere(guard.scope, "id") },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, address: true, freezePolicy: true },
  });

  return NextResponse.json(
    locations.map(({ freezePolicy, ...location }) => ({ location, policy: freezePolicy })),
  );
}
