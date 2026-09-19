/**
 * Stripe Tax product tax codes for POS line items.
 *
 * Confirmed by Sam (2026-09-12):
 *   - retail goods, clay, firing and custom items: general tangible goods
 *   - gift cards: nontaxable (tax is collected when the card is spent)
 *   - class drop-ins and memberships: nontaxable until JP says otherwise
 * Tips are never sent to Stripe Tax (they're not a line item).
 *
 * Catalog products (docs/throw-catalog.md §2.2 and §3) take the code of their
 * category unless the product row sets its own `taxCode`:
 *   - pieces, firing, clay, retail: general tangible goods
 *   - shipping: Stripe's shipping code
 *   - class packs: nontaxable, like the drop-ins they prepay
 *
 * `null` means "don't send this line to Stripe Tax" — it's charged with no tax.
 * Change a value here and every new line item picks it up; existing line items
 * keep the code they were created with (PosOrderItem.taxCode).
 */

export const GENERAL_TANGIBLE_GOODS = "txcd_99999999";
export const SHIPPING = "txcd_92010001";

export type PosItemType = "RETAIL" | "DROP_IN" | "MEMBERSHIP" | "GIFT_CARD" | "CUSTOM";

export const POS_ITEM_TAX_CODES: Record<PosItemType, string | null> = {
  RETAIL: GENERAL_TANGIBLE_GOODS,
  // Also covers the Clay & firing tab, which adds CUSTOM lines.
  CUSTOM: GENERAL_TANGIBLE_GOODS,
  GIFT_CARD: null,
  DROP_IN: null,
  MEMBERSHIP: null,
};

export const PRODUCT_CATEGORIES = ["RETAIL", "PIECES", "FIRING", "CLAY", "CLASS_PACK", "SHIPPING"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  RETAIL: "Retail",
  PIECES: "Pieces",
  FIRING: "Member firing",
  CLAY: "Clay",
  CLASS_PACK: "Class packs",
  SHIPPING: "Shipping",
};

export const PRODUCT_CATEGORY_TAX_CODES: Record<ProductCategory, string | null> = {
  RETAIL: GENERAL_TANGIBLE_GOODS,
  PIECES: GENERAL_TANGIBLE_GOODS,
  FIRING: GENERAL_TANGIBLE_GOODS,
  CLAY: GENERAL_TANGIBLE_GOODS,
  CLASS_PACK: null,
  SHIPPING,
};

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The tax code a new line gets. For RETAIL lines pass the product's category
 * and its own `taxCode`: the product's code wins, then the category default,
 * then the item type default.
 */
export function taxCodeForPosItem(
  itemType: PosItemType,
  product?: { category?: string | null; taxCode?: string | null },
): string | null {
  if (itemType === "RETAIL" && product) {
    if (product.taxCode) return product.taxCode;
    if (isProductCategory(product.category)) return PRODUCT_CATEGORY_TAX_CODES[product.category];
  }
  return POS_ITEM_TAX_CODES[itemType];
}
