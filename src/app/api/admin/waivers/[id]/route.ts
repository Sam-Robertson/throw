import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isWaiverKind } from "@/lib/waiverKinds";
import { WAIVER_ADMIN_SELECT, parseScope } from "../_shared";

/**
 * Renames, describes, re-scopes, archives or restores a waiver.
 * Body: `{ name?, description?, archived?, appliesTo?, sessionTypeIds?,
 * planIds? }`. Kind and studio can't change once people have signed against
 * them — publish a new waiver instead. What it applies to can: the document
 * (and its signatures) stay the same, only when it is asked for changes.
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
    appliesTo?: unknown;
    sessionTypeIds?: unknown;
    planIds?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const existing = await prisma.waiver.findUnique({
    where: { id },
    select: { id: true, kind: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Prisma.WaiverUpdateInput = {};
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
  if (body.appliesTo !== undefined) {
    const kind = isWaiverKind(existing.kind) ? existing.kind : "CLASS";
    const scope = parseScope(kind, body);
    if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: 400 });
    if (scope.sessionTypeIds.length) {
      const found = await prisma.sessionType.count({ where: { id: { in: scope.sessionTypeIds } } });
      if (found !== scope.sessionTypeIds.length)
        return NextResponse.json({ error: "Unknown class type" }, { status: 400 });
    }
    if (scope.planIds.length) {
      const found = await prisma.membershipPlan.count({ where: { id: { in: scope.planIds } } });
      if (found !== scope.planIds.length)
        return NextResponse.json({ error: "Unknown membership plan" }, { status: 400 });
    }
    data.appliesTo = scope.appliesTo;
    data.sessionTypes = {
      deleteMany: {},
      create: scope.sessionTypeIds.map((sessionTypeId) => ({ sessionTypeId })),
    };
    data.plans = { deleteMany: {}, create: scope.planIds.map((planId) => ({ planId })) };
  }

  const waiver = await prisma.waiver.update({ where: { id }, data, select: WAIVER_ADMIN_SELECT });
  return NextResponse.json(waiver);
}
