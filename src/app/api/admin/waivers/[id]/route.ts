import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WAIVER_ADMIN_SELECT } from "../_shared";

/**
 * Renames, describes, archives or restores a waiver.
 * Body: `{ name?, description?, archived? }`. Kind and studio can't change
 * once people have signed against them — publish a new waiver instead.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    archived?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const existing = await prisma.waiver.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { name?: string; description?: string | null; archivedAt?: Date | null } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, 500)
        : null;
  }
  if (body.archived !== undefined) {
    data.archivedAt = body.archived === true ? (existing.archivedAt ?? new Date()) : null;
  }

  const waiver = await prisma.waiver.update({ where: { id }, data, select: WAIVER_ADMIN_SELECT });
  return NextResponse.json(waiver);
}
