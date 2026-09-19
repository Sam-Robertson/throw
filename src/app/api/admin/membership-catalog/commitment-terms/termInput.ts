import type { Prisma } from "@prisma/client";
import { flag, has, text, wholeNumber, wholeNumberOrNull, type Body } from "../_lib/input";

// Create-input field types are plain values, valid for both create and update.
export type TermInput = Partial<Omit<Prisma.CommitmentTermUncheckedCreateInput, "id" | "memberships">>;

/** Returns only the fields present in `body`, validated. Throws InputError. */
export function parseTermInput(body: Body): TermInput {
  const data: TermInput = {};
  if (has(body, "name")) data.name = text(body, "name");
  if (has(body, "slug")) data.slug = text(body, "slug");
  // null months = month to month.
  if (has(body, "months")) data.months = wholeNumberOrNull(body, "months", 1);
  if (has(body, "joiningFeeCents")) data.joiningFeeCents = wholeNumber(body, "joiningFeeCents");
  if (has(body, "retailDiscountPercent"))
    data.retailDiscountPercent = wholeNumber(body, "retailDiscountPercent", 0, 100);
  if (has(body, "includesGuestPass")) data.includesGuestPass = flag(body, "includesGuestPass");
  if (has(body, "includesVideoLibrary"))
    data.includesVideoLibrary = flag(body, "includesVideoLibrary");
  if (has(body, "freeMonths")) data.freeMonths = wholeNumber(body, "freeMonths");
  if (has(body, "isActive")) data.isActive = flag(body, "isActive");
  if (has(body, "sortOrder")) data.sortOrder = wholeNumber(body, "sortOrder");
  return data;
}
