// Form helpers shared by the tabs on /admin/membership-plans. Money is typed
// in dollars and sent to the API as integer cents.

export function centsToDollars(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** '' -> null. Returns NaN for anything that isn't a valid amount. */
export function dollarsToCents(dollars: string): number | null {
  if (dollars.trim() === '') return null;
  const value = Number(dollars);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : NaN;
}

/** '' -> null. Returns NaN for anything that isn't a whole number. */
export function toWholeNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : NaN;
}

export function formatMoney(cents: number | null): string {
  return cents === null ? '—' : `$${(cents / 100).toFixed(2)}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Sends JSON and returns the parsed body, or throws the API's error message. */
export async function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
  return data as T;
}
