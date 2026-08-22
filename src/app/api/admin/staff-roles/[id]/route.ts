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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    permissions?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.permissions !== undefined && !isValidPermissions(body.permissions)) {
    return NextResponse.json(
      { error: "permissions must contain only known keys with boolean values" },
      { status: 400 },
    );
  }

  const updated = await prisma.staffRole.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.permissions !== undefined && {
        permissions: body.permissions as Prisma.InputJsonValue,
      }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const assignmentCount = await prisma.staffRoleAssignment.count({
    where: { staffRoleId: id },
  });
  if (assignmentCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a role that is assigned to staff. Reassign them first." },
      { status: 400 },
    );
  }

  await prisma.staffRole.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
