import { DISCOUNT_APPLIES_VIA, DISCOUNT_SCOPES, DISCOUNT_TYPES } from "@/lib/discounts";

/** The DiscountCode columns admin can edit. Plain values, so it fits create and update alike. */
export type DiscountFields = Partial<{
  code: string;
  name: string | null;
  description: string | null;
  type: string;
  value: number;
  scope: string;
  appliesVia: string;
  autoCommitmentMonths: number | null;
  sessionTypeId: string | null;
  productSlug: string | null;
  maxUnits: number | null;
  maxUses: number | null;
  maxUsesPerCustomerPerYear: number | null;
  requiresNote: boolean;
  requiresGroupEvent: boolean;
  locationId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}>;

/** Codes are stored upper case; customers can type them in any case. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code) ? code : null;
}

/**
 * Validates the editable DiscountCode fields from an admin request body. Only
 * keys present in the body are returned, so PATCH stays partial. Rules that
 * span fields (percent range, automatic needs months, date order) are checked
 * by `checkDiscountFields` against the merged row.
 */
export function parseDiscountFields(
  body: Record<string, unknown>,
): { ok: true; data: DiscountFields } | { ok: false; error: string } {
  const data: DiscountFields = {};

  if (body.code !== undefined) {
    const code = normalizeCode(body.code);
    if (!code) return { ok: false, error: "Code must be 2–40 letters, numbers, dashes or underscores" };
    data.code = code;
  }

  for (const key of ["name", "description", "sessionTypeId", "productSlug", "locationId"] as const) {
    if (body[key] === undefined) continue;
    const value = body[key];
    data[key] = typeof value === "string" && value.trim() ? value.trim() : null;
  }

  const oneOf = (key: "type" | "scope" | "appliesVia", allowed: readonly string[]): string | null => {
    if (body[key] === undefined) return null;
    if (typeof body[key] !== "string" || !allowed.includes(body[key] as string)) {
      return `${key} must be one of ${allowed.join(", ")}`;
    }
    data[key] = body[key] as string;
    return null;
  };
  for (const error of [
    oneOf("type", DISCOUNT_TYPES),
    oneOf("scope", DISCOUNT_SCOPES),
    oneOf("appliesVia", DISCOUNT_APPLIES_VIA),
  ]) {
    if (error) return { ok: false, error };
  }

  if (body.value !== undefined) {
    if (typeof body.value !== "number" || !Number.isInteger(body.value) || body.value <= 0) {
      return { ok: false, error: "Value must be a whole number greater than 0" };
    }
    data.value = body.value;
  }

  for (const key of ["autoCommitmentMonths", "maxUnits", "maxUses", "maxUsesPerCustomerPerYear"] as const) {
    if (body[key] === undefined) continue;
    const value = body[key];
    if (value === null || value === "") {
      data[key] = null;
    } else if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      data[key] = value;
    } else {
      return { ok: false, error: `${key} must be a whole number greater than 0, or empty` };
    }
  }

  for (const key of ["requiresNote", "requiresGroupEvent", "isActive"] as const) {
    if (typeof body[key] === "boolean") data[key] = body[key] as boolean;
  }

  for (const key of ["validFrom", "validUntil"] as const) {
    if (body[key] === undefined) continue;
    const value = body[key];
    if (value === null || value === "") {
      data[key] = null;
      continue;
    }
    const date = new Date(value as string);
    if (typeof value !== "string" || Number.isNaN(date.getTime())) {
      return { ok: false, error: `${key} is not a valid date` };
    }
    data[key] = date;
  }

  return { ok: true, data };
}

/** Cross-field rules, checked on the row as it will be saved. */
export function checkDiscountFields(row: {
  type: string;
  value: number;
  appliesVia: string;
  autoCommitmentMonths: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
}): string | null {
  if (row.type === "percent" && row.value > 100) return "A percent discount can't be more than 100";
  if (row.appliesVia === "AUTOMATIC" && row.autoCommitmentMonths == null) {
    return "An automatic discount needs the commitment length (months) it applies to";
  }
  if (row.validFrom && row.validUntil && row.validUntil <= row.validFrom) {
    return "The end date must be after the start date";
  }
  return null;
}
