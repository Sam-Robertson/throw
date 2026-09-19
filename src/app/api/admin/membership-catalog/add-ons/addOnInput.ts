import type { Prisma } from "@prisma/client";
import { flag, has, text, textOrNull, wholeNumber, wholeNumberOrNull, type Body } from "../_lib/input";

export const addOnInclude = {
  location: { select: { id: true, name: true } },
  _count: { select: { assignments: { where: { endedAt: null } } } },
} satisfies Prisma.MembershipAddOnInclude;

// Create-input field types are plain values, valid for both create and update.
export type AddOnInput = Partial<Omit<Prisma.MembershipAddOnUncheckedCreateInput, "id" | "assignments">>;

/** Returns only the fields present in `body`, validated. Throws InputError. */
export function parseAddOnInput(body: Body): AddOnInput {
  const data: AddOnInput = {};
  if (has(body, "name")) data.name = text(body, "name");
  if (has(body, "slug")) data.slug = text(body, "slug");
  if (has(body, "description")) data.description = textOrNull(body, "description");
  // null price = not priced yet.
  if (has(body, "priceCents")) data.priceCents = wholeNumberOrNull(body, "priceCents");
  if (has(body, "billingIntervalDays"))
    data.billingIntervalDays = wholeNumber(body, "billingIntervalDays", 1);
  // null studio = sold at every studio.
  if (has(body, "locationId")) data.locationId = textOrNull(body, "locationId");
  if (has(body, "isActive")) data.isActive = flag(body, "isActive");
  return data;
}
