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
import { capGroupInclude, parseCapGroupInput, withSold } from "./capGroupInput";

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  const groups = await prisma.membershipCapGroup.findMany({
    where: locationWhereOrUnassigned(guard.scope),
    orderBy: { name: "asc" },
    include: capGroupInclude,
  });
  return NextResponse.json(await withSold(groups));
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let data;
  try {
    data = parseCapGroupInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }
  const { name, slug, cap } = data;
  if (typeof name !== "string" || typeof slug !== "string" || typeof cap !== "number")
    return NextResponse.json({ error: "Name, slug and cap are required" }, { status: 400 });

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

  try {
    const group = await prisma.membershipCapGroup.create({
      data: { ...data, name, slug, cap },
      include: capGroupInclude,
    });
    return NextResponse.json({ ...group, sold: 0 }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "A cap group with this slug already exists" }, { status: 409 });
    throw err;
  }
}
