/**
 * Placeholder emails for customers created at the register with only a phone
 * number. `User.email` is required and unique, so they get
 * `walkin-<random>@walkin.invalid`. The `.invalid` TLD can never deliver mail
 * (RFC 2606), and every sender skips these addresses.
 *
 * Pure and client-safe: the POS hides these addresses instead of showing them.
 */

export const WALKIN_EMAIL_DOMAIN = "walkin.invalid";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${WALKIN_EMAIL_DOMAIN}`);
}

export function generatePlaceholderEmail(): string {
  const random = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `walkin-${random}@${WALKIN_EMAIL_DOMAIN}`;
}

/** The email to show or send to, or null when it is only a placeholder. */
export function realEmail(email: string | null | undefined): string | null {
  return email && !isPlaceholderEmail(email) ? email : null;
}
