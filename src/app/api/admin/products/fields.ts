import { prisma } from "@/lib/prisma";
import { isProductCategory } from "@/config/taxCodes";

/** The RetailProduct columns admin can edit. Plain values, so it fits create and update alike. */
export type ProductFields = Partial<{
  name: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  taxCode: string | null;
  locationId: string | null;
  priceCents: number;
  minChargeCents: number | null;
  inventory: number;
  sortOrder: number;
  classCredits: number | null;
  isActive: boolean;
  isPriced: boolean;
  membersOnly: boolean;
  trackInventory: boolean;
  category: string;
  unit: string;
  archivedAt: Date | null;
}>;

/**
 * Validates the editable RetailProduct fields from an admin request body.
 * Only keys present in the body are returned, so PATCH stays partial. `slug`
 * is never accepted: it is the sync script's stable key (scripts/sync-products.ts).
 */
export function parseProductFields(
  body: Record<string, unknown>,
): { ok: true; data: ProductFields } | { ok: false; error: string } {
  const data: ProductFields = {};

  const optionalText = (key: "description" | "sku" | "imageUrl" | "taxCode" | "locationId") => {
    if (body[key] === undefined) return;
    const value = body[key];
    data[key] = typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const cents = (key: "priceCents" | "minChargeCents", nullable: boolean): string | null => {
    if (body[key] === undefined) return null;
    const value = body[key];
    if (value === null && nullable) {
      (data as Record<string, unknown>)[key] = null;
      return null;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return `${key} must be a whole number of cents, zero or more`;
    }
    (data as Record<string, unknown>)[key] = value;
    return null;
  };
  const int = (key: "inventory" | "sortOrder" | "classCredits", nullable: boolean): string | null => {
    if (body[key] === undefined) return null;
    const value = body[key];
    if (value === null && nullable) {
      (data as Record<string, unknown>)[key] = null;
      return null;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return `${key} must be a whole number, zero or more`;
    }
    (data as Record<string, unknown>)[key] = value;
    return null;
  };
  const bool = (key: "isActive" | "isPriced" | "membersOnly" | "trackInventory") => {
    if (typeof body[key] === "boolean") (data as Record<string, unknown>)[key] = body[key];
  };

  optionalText("description");
  optionalText("sku");
  optionalText("imageUrl");
  optionalText("taxCode");
  optionalText("locationId");

  for (const error of [
    cents("priceCents", false),
    cents("minChargeCents", true),
    int("inventory", false),
    int("sortOrder", false),
    int("classCredits", true),
  ]) {
    if (error) return { ok: false, error };
  }

  bool("isActive");
  bool("isPriced");
  bool("membersOnly");
  bool("trackInventory");

  if (body.category !== undefined) {
    if (!isProductCategory(body.category)) return { ok: false, error: "Unknown category" };
    data.category = body.category;
  }
  if (body.unit !== undefined) {
    if (body.unit !== "EACH" && body.unit !== "LB") return { ok: false, error: "unit must be EACH or LB" };
    data.unit = body.unit;
  }
  if (typeof data.taxCode === "string" && !/^txcd_\d{8}$/.test(data.taxCode)) {
    return { ok: false, error: "Tax code must look like txcd_99999999 (or leave it blank for the category default)" };
  }

  return { ok: true, data };
}

/** A slug for a product made in admin: from the name, with a number on the end if it's taken. */
export async function uniqueProductSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await prisma.retailProduct.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
}
