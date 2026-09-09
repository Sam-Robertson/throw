/**
 * Short display label for a studio.
 *
 * Studios are all named "Throw Art Studio…", which is useless in a switcher, so
 * a short label is derived rather than adding a column for it:
 *
 *   "Throw Art Studio - Lehi"  ->  "Lehi"    (suffix after " - ")
 *   "Throw Art Studio"         ->  "Provo"   (city from the address)
 *
 * The address fallback takes the token before the trailing state, matching what
 * the current records look like ("308 E 300 S Provo Utah"). Anything it can't
 * read falls back to the full name — unlovely, but never silently wrong.
 *
 * If studios are ever renamed properly, or a shortName column is added, this
 * becomes a one-line change at its single call site.
 */
export function shortLocationName(name: string, address?: string | null): string {
  const dash = name.lastIndexOf(" - ");
  if (dash !== -1) {
    const suffix = name.slice(dash + 3).trim();
    if (suffix) return suffix;
  }

  if (address) {
    const words = address.trim().split(/[\s,]+/).filter(Boolean);
    const stateIndex = words.findIndex((w) => /^(utah|ut)$/i.test(w));
    if (stateIndex > 0) return words[stateIndex - 1];
  }

  return name;
}
