/**
 * Gift card codes. One alphabet and one format for every place a card is
 * issued (POS sale, admin issue form), and one forgiving lookup for every
 * place a code is typed (POS tender, online checkout).
 *
 * Pure and client-safe: the admin page imports it too.
 */

/** No 0/O, 1/I/L: nothing a customer can misread off a printed card. */
export const GIFT_CARD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const GIFT_CARD_CODE_LENGTH = 12;

/** 12 characters, stored without separators. */
export function generateGiftCardCode(): string {
  let code = "";
  for (let i = 0; i < GIFT_CARD_CODE_LENGTH; i++) {
    code += GIFT_CARD_ALPHABET[Math.floor(Math.random() * GIFT_CARD_ALPHABET.length)];
  }
  return code;
}

/** For display and receipts: ABCD-EFGH-JKMN. Codes that aren't 12 plain characters are shown as stored. */
export function formatGiftCardCode(code: string): string {
  return /^[A-Z0-9]{12}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}` : code;
}

/**
 * Every stored form a typed code could match. Cards issued before the formats
 * were unified are stored WITH dashes (ABCD-EFGH-JKLM), newer ones without,
 * and imported Momence codes are stored as they came — so look up
 * `code: { in: giftCardCodeCandidates(input) }`.
 */
export function giftCardCodeCandidates(input: string): string[] {
  const typed = input.trim().toUpperCase();
  if (!typed) return [];
  const plain = typed.replace(/[\s-]+/g, "");
  const candidates = new Set([typed, plain]);
  if (plain.length === GIFT_CARD_CODE_LENGTH) candidates.add(formatGiftCardCode(plain));
  return [...candidates];
}
