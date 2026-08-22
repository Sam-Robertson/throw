import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PermissionKey } from "@/lib/permissions";

const PERMISSION_KEYS: readonly PermissionKey[] = [
  "canViewTips",
  "canViewMembershipReporting",
  "canViewBilling",
  "canManageSchedule",
  "canCheckInMembers",
  "canManageTasks",
  "canUsePos",
];

function isValidPermissions(input: unknown): input is Partial<Record<PermissionKey, boolean>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  for (const [key, value] of Object.entries(input)) {
    if (!PERMISSION_KEYS.includes(key as PermissionKey)) return false;
    if (typeof value !== "boolean") return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const roles = await prisma.staffRole.findMany({
    where: locationId ? { locationId } : {},
    include: {
      location: { select: { id: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      locationId: r.locationId,
      locationName: r.location.name,
      permissions: r.permissions,
      assignmentCount: r._count.assignments,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    locationId?: string;
    permissions?: unknown;
  } | null;

  if (!body?.name?.trim() || !body.locationId) {
    return NextResponse.json({ error: "name and locationId are required" }, { status: 400 });
  }

  const permissions = body.permissions ?? {};
  if (!isValidPermissions(permissions)) {
    return NextResponse.json(
      { error: "permissions must contain only known keys with boolean values" },
      { status: 400 },
    );
  }

  const existing = await prisma.staffRole.findFirst({
    where: { name: body.name.trim(), locationId: body.locationId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A role with this name already exists at this location" },
      { status: 409 },
    );
  }

  const role = await prisma.staffRole.create({
    data: {
      name: body.name.trim(),
      locationId: body.locationId,
      permissions: permissions as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(role, { status: 201 });
}
