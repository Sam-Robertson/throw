import { prisma } from "@/lib/prisma";

/**
 * Shared by the instructors API routes: the user shape the Instructors page
 * shows, and the studio assignment validation and replacement both the
 * create and edit routes use.
 */

export const instructorSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  hashedPassword: true,
  createdAt: true,
  // StaffRoleAssignment has no relation to Location; names come from locationNames().
  staffRoleAssignments: {
    select: {
      locationId: true,
      staffRoleId: true,
      staffRole: { select: { name: true } },
    },
  },
  payRates: {
    where: { isActive: true },
    select: { id: true, rateType: true, amountCents: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

type InstructorRecord = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  hashedPassword: string | null;
  createdAt: Date;
  staffRoleAssignments: {
    locationId: string;
    staffRoleId: string;
    staffRole: { name: string };
  }[];
  payRates: { id: string; rateType: string; amountCents: number }[];
};

/** Studio id → name, for the assignment chips. */
export async function locationNames(): Promise<Map<string, string>> {
  const rows = await prisma.location.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((l) => [l.id, l.name]));
}

export function toInstructorRow(u: InstructorRecord, names: Map<string, string>) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    hasPassword: u.hashedPassword !== null,
    createdAt: u.createdAt,
    studios: u.staffRoleAssignments.map((a) => ({
      locationId: a.locationId,
      locationName: names.get(a.locationId) ?? a.locationId,
      staffRoleId: a.staffRoleId,
      staffRoleName: a.staffRole.name,
    })),
    defaultPayRate: u.payRates[0] ?? null,
  };
}

export type AssignmentInput = { locationId: string; staffRoleId: string };

/** Checks the assignments name real studios and roles that belong to them. */
export async function validateAssignments(input: unknown): Promise<AssignmentInput[] | string> {
  if (!Array.isArray(input)) return "assignments must be a list";
  const assignments: AssignmentInput[] = [];
  for (const a of input) {
    if (typeof a !== "object" || a === null) return "Each assignment needs a locationId and staffRoleId";
    const { locationId, staffRoleId } = a as Record<string, unknown>;
    if (typeof locationId !== "string" || typeof staffRoleId !== "string") {
      return "Each assignment needs a locationId and staffRoleId";
    }
    assignments.push({ locationId, staffRoleId });
  }
  if (new Set(assignments.map((a) => a.locationId)).size !== assignments.length) {
    return "One role per studio";
  }
  if (assignments.length > 0) {
    const roles = await prisma.staffRole.findMany({
      where: { id: { in: assignments.map((a) => a.staffRoleId) } },
      select: { id: true, locationId: true },
    });
    for (const a of assignments) {
      const role = roles.find((r) => r.id === a.staffRoleId);
      if (!role) return "That staff role doesn't exist";
      if (role.locationId !== a.locationId) return "That role belongs to a different studio";
    }
  }
  return assignments;
}

/** Replaces the user's studio assignments with `assignments`. */
export async function replaceAssignments(userId: string, assignments: AssignmentInput[]) {
  await prisma.$transaction([
    prisma.staffRoleAssignment.deleteMany({
      where: { userId, locationId: { notIn: assignments.map((a) => a.locationId) } },
    }),
    ...assignments.map((a) =>
      prisma.staffRoleAssignment.upsert({
        where: { userId_locationId: { userId, locationId: a.locationId } },
        update: { staffRoleId: a.staffRoleId },
        create: { userId, locationId: a.locationId, staffRoleId: a.staffRoleId },
      }),
    ),
  ]);
}

