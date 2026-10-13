import { prisma } from "@/lib/prisma";

/**
 * The studio a membership or payment belongs to when neither the membership
 * nor its plan names one: the oldest active studio, which is Provo. Sam's rule
 * (2026-09-12) is that memberships default to Provo for now.
 */
export async function defaultStudioLocationId(): Promise<string | undefined> {
  const location = await prisma.location.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return location?.id;
}
