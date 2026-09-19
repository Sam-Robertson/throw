import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, resolveLocationScope, scopeAllows } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { adminOnlyResponse, inputErrorResponse, type Body } from "../../_lib/input";
import { addOnInclude, parseAddOnInput } from "../addOnInput";

// Add-ons are archived ({ archived: true }), never deleted: assignments on
// memberships point at them.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.membershipAddOn.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data;
  try {
    data = parseAddOnInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }

  // Touching an every-studio add-on, or making one, is an admin decision.
  const targetLocationId = data.locationId === undefined ? existing.locationId : data.locationId;
  if (existing.locationId === null || targetLocationId === null) {
    const denied = adminOnlyResponse(guard.session);
    if (denied) return denied;
  } else {
    if (!scopeAllows(guard.scope, existing.locationId))
      return NextResponse.json(
        { error: "This add-on belongs to a studio you don't have access to" },
        { status: 403 },
      );
    try {
      resolveLocationScope(guard.session, String(targetLocationId));
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  if (body.archived === true) {
    data.isActive = false;
    data.archivedAt = existing.archivedAt ?? new Date();
  } else if (body.archived === false) {
    data.archivedAt = null;
  }

  // An add-on with no price can't be on sale.
  const priceCents = data.priceCents === undefined ? existing.priceCents : data.priceCents;
  if (priceCents === null) data.isActive = false;

  try {
    const addOn = await prisma.membershipAddOn.update({ where: { id }, data, include: addOnInclude });
    return NextResponse.json(addOn);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "An add-on with this slug already exists" }, { status: 409 });
    throw err;
  }
}
