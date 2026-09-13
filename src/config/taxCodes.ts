/**
 * Stripe Tax product tax codes for POS line items.
 *
 * Confirmed by Sam (2026-09-12):
 *   - retail goods, clay, firing and custom items: general tangible goods
 *   - gift cards: nontaxable (tax is collected when the card is spent)
 *   - class drop-ins and memberships: nontaxable until JP says otherwise
 * Tips are never sent to Stripe Tax (they're not a line item).
 *
 * `null` means "don't send this line to Stripe Tax" — it's charged with no tax.
 * Change a value here and every new line item picks it up; existing line items
 * keep the code they were created with (PosOrderItem.taxCode).
 */

export const GENERAL_TANGIBLE_GOODS = "txcd_99999999";

export type PosItemType = "RETAIL" | "DROP_IN" | "MEMBERSHIP" | "GIFT_CARD" | "CUSTOM";

export const POS_ITEM_TAX_CODES: Record<PosItemType, string | null> = {
  RETAIL: GENERAL_TANGIBLE_GOODS,
  // Also covers the Clay & firing tab, which adds CUSTOM lines.
  CUSTOM: GENERAL_TANGIBLE_GOODS,
  GIFT_CARD: null,
  DROP_IN: null,
  MEMBERSHIP: null,
};

export function taxCodeForPosItem(itemType: PosItemType): string | null {
  return POS_ITEM_TAX_CODES[itemType];
}
