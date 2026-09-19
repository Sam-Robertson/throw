import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffScope } from "@/lib/staffScope";
import { adminOnlyResponse, inputErrorResponse, type Body } from "../../_lib/input";
import { parseTermInput } from "../termInput";

// Terms are switched off with isActive, never deleted: memberships point at
// the term they were sold on.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;
  const denied = adminOnlyResponse(guard.session);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let data;
  try {
    data = parseTermInput(body);
  } catch (err) {
    return inputErrorResponse(err);
  }

  try {
    const term = await prisma.commitmentTerm.update({
      where: { id },
      data,
      include: { _count: { select: { memberships: true } } },
    });
    return NextResponse.json(term);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (err.code === "P2002")
        return NextResponse.json({ error: "A term with this slug already exists" }, { status: 409 });
    }
    throw err;
  }
}
