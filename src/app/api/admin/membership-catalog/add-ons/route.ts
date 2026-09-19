import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  locationWhereOrUnassigned,
  resolveLocationScope,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { adminOnlyResponse, inputErrorResponse, type Body } from "../_lib/input";
import { addOnInclude, parseAddOnInput } from "./addOnInput";

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  const addOns = await prisma.membershipAddOn.findMany({
    where: locationWhereOrUnassigned(guard.scope),
    orderBy: { name: "asc" },
    include: addOnInclude,
  });
  return NextResponse.json(addOns);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let data;
  try {
    data = parseAddOnInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }
  const { name, slug } = data;
  if (typeof name !== "string" || typeof slug !== "string")
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });

  if (typeof data.locationId === "string") {
    try {
      resolveLocationScope(guard.session, data.locationId);
    } catch (err) {
      return forbiddenResponse(err);
    }
  } else {
    const denied = adminOnlyResponse(guard.session);
    if (denied) return denied;
  }

  // An add-on with no price can't be on sale.
  const isActive = data.priceCents == null ? false : data.isActive;

  try {
    const addOn = await prisma.membershipAddOn.create({
      data: { ...data, name, slug, isActive },
      include: addOnInclude,
    });
    return NextResponse.json(addOn, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "An add-on with this slug already exists" }, { status: 409 });
    throw err;
  }
}
