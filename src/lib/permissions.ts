import { prisma } from "@/lib/prisma";

export type PermissionKey =
  | "canViewTips"
  | "canViewMembershipReporting"
  | "canViewBilling"
  | "canManageSchedule"
  | "canCheckInMembers"
  | "canManageTasks"
  | "canUsePos";

export async function checkPermission(
  userId: string,
  key: PermissionKey,
  locationId?: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;

  // Every staff member can use the POS (Sam, 2026-09-12), whatever their role's
  // toggle says — but only at a studio they're assigned to, so location scoping
  // still holds and staff with no assignment still can't.
  if (key === "canUsePos") {
    const assigned = await prisma.staffRoleAssignment.findFirst({
      where: { userId, ...(locationId ? { locationId } : {}) },
      select: { id: true },
    });
    return assigned !== null;
  }

  const assignment = await prisma.staffRoleAssignment.findFirst({
    where: {
      userId,
      ...(locationId ? { locationId } : {}),
    },
    include: { staffRole: true },
  });
  if (!assignment) return false;

  const permissions = assignment.staffRole.permissions as Record<string, boolean>;
  return Boolean(permissions[key]);
}
