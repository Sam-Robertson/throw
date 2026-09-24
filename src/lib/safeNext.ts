/**
 * Only same-site relative paths are allowed as post-login / post-signing
 * redirects, so a crafted ?callbackUrl=https://… link can't bounce someone
 * off-site. Client-safe (no imports).
 */
export function safeNext(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
