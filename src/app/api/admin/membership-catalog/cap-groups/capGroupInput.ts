import type { Prisma } from "@prisma/client";
import { getCapGroupUsage } from "@/lib/membershipCatalog";
import { has, text, textOrNull, wholeNumber, type Body } from "../_lib/input";

export const capGroupInclude = {
  location: { select: { id: true, name: true } },
  plans: { select: { id: true, name: true, slug: true }, orderBy: { price: "asc" } },
} satisfies Prisma.MembershipCapGroupInclude;

type CapGroupRow = Prisma.MembershipCapGroupGetPayload<{ include: typeof capGroupInclude }>;

/** Adds `sold`: memberships counted against the cap across every plan in the group. */
export async function withSold<T extends CapGroupRow>(groups: T[]) {
  const usage = await getCapGroupUsage(groups.map((g) => g.id));
  return groups.map((group) => ({ ...group, sold: usage.get(group.id)?.sold ?? 0 }));
}

// Create-input field types are plain values, valid for both create and update.
export type CapGroupInput = Partial<Omit<Prisma.MembershipCapGroupUncheckedCreateInput, "id" | "plans">>;

/** Returns only the fields present in `body`, validated. Throws InputError. */
export function parseCapGroupInput(body: Body): CapGroupInput {
  const data: CapGroupInput = {};
  if (has(body, "name")) data.name = text(body, "name");
  if (has(body, "slug")) data.slug = text(body, "slug");
  if (has(body, "cap")) data.cap = wholeNumber(body, "cap");
  if (has(body, "locationId")) data.locationId = textOrNull(body, "locationId");
  return data;
}
