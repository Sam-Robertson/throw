import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffScope } from "@/lib/staffScope";
import { adminOnlyResponse, inputErrorResponse, type Body } from "../_lib/input";
import { parseTermInput } from "./termInput";

export async function GET() {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const terms = await prisma.commitmentTerm.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { memberships: true } } },
  });
  return NextResponse.json(terms);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;
  const denied = adminOnlyResponse(guard.session);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let data;
  try {
    data = parseTermInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }
  const { name, slug } = data;
  if (typeof name !== "string" || typeof slug !== "string")
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });

  try {
    const term = await prisma.commitmentTerm.create({
      data: { ...data, name, slug },
      include: { _count: { select: { memberships: true } } },
    });
    return NextResponse.json(term, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "A term with this slug already exists" }, { status: 409 });
    throw err;
  }
}
