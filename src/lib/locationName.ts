/**
 * Short display label for a studio.
 *
 * Studios are named by city ("Provo", "Lehi") since the studio-short-names
 * migration, so the name is the label. The parsing below only still matters
 * for a database that has not run that migration yet, where the studios are
 * "Throw Art Studio" and "Throw Art Studio - Lehi":
 *
 *   "Throw Art Studio - Lehi"  ->  "Lehi"    (suffix after " - ")
 *   "Throw Art Studio"         ->  "Provo"   (city from the address)
 */
export function shortLocationName(name: string, address?: string | null): string {
  if (!/^throw art studio/i.test(name.trim())) return name;

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
