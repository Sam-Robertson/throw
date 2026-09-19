import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, resolveLocationScope, scopeAllows } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { adminOnlyResponse, inputErrorResponse, type Body } from "../../_lib/input";
import { capGroupInclude, parseCapGroupInput, withSold } from "../capGroupInput";

// Lowering a cap below what has been sold is allowed: nobody loses their
// membership, the plans in the group simply stop selling.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.membershipCapGroup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data;
  try {
    data = parseCapGroupInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }

  const targetLocationId = data.locationId === undefined ? existing.locationId : data.locationId;
  if (existing.locationId === null || targetLocationId === null) {
    const denied = adminOnlyResponse(guard.session);
    if (denied) return denied;
  } else {
    if (!scopeAllows(guard.scope, existing.locationId))
      return NextResponse.json(
        { error: "This cap group belongs to a studio you don't have access to" },
        { status: 403 },
      );
    try {
      resolveLocationScope(guard.session, String(targetLocationId));
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  try {
    const group = await prisma.membershipCapGroup.update({
      where: { id },
      data,
      include: capGroupInclude,
    });
    return NextResponse.json((await withSold([group]))[0]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "A cap group with this slug already exists" }, { status: 409 });
    throw err;
  }
}
