// Shared helpers for the one-off CSV import scripts (import-gift-cards.ts,
// import-waiver-signatures.ts). No CSV dependency is installed, so this is a
// small RFC 4180-style parser: quoted fields, "" escapes, commas and newlines
// inside quotes, CRLF, and a leading BOM.
import { fromZonedTime } from "date-fns-tz";

const STUDIO_TIMEZONE = "America/Denver";

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines (e.g. a trailing newline).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** "Gift Card Code" -> "giftcardcode", "purchaser_email" -> "purchaseremail". */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Maps each wanted column to a header index. Synonyms are tried in order, so
 * put the most specific first; each header is claimed by at most one column.
 */
export function detectColumns<K extends string>(
  headers: string[],
  synonyms: Record<K, string[]>,
): Record<K, number | null> {
  const normalized = headers.map(normalizeHeader);
  const claimed = new Set<number>();
  const mapping = {} as Record<K, number | null>;
  for (const key of Object.keys(synonyms) as K[]) {
    mapping[key] = null;
    for (const candidate of synonyms[key]) {
      const index = normalized.findIndex((h, i) => h === candidate && !claimed.has(i));
      if (index !== -1) {
        mapping[key] = index;
        claimed.add(index);
        break;
      }
    }
  }
  return mapping;
}

export function printMapping<K extends string>(
  headers: string[],
  mapping: Record<K, number | null>,
): void {
  console.log("Detected column mapping:");
  for (const key of Object.keys(mapping) as K[]) {
    const index = mapping[key];
    console.log(`  ${key.padEnd(16)} <- ${index === null ? "(not found)" : `"${headers[index]}"`}`);
  }
}

/** "$1,050.50" / "25" / "25.5" -> cents. Null for blank, invalid or negative. */
export function parseDollarsToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

function toHour24(hour: string, meridiem: string | undefined): string {
  let h = Number(hour);
  if (meridiem) {
    const pm = meridiem.toLowerCase() === "pm";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return String(h);
}

/**
 * Parses a CSV date. Strings with an explicit zone ("Z" or "+hh:mm") are taken
 * as-is; date-only and zone-less date-times (YYYY-MM-DD[ HH:mm[:ss]] or
 * M/D/YYYY[ h:mm[:ss] [am|pm]]) are read as studio (Mountain) local time.
 */
export function parseDate(value: string): Date | null {
  const v = value.trim();
  if (v === "") return null;

  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(v) && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const us = v.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
  );

  let local: string | null = null;
  if (iso) {
    const [, y, m, d, hh = "0", mm = "00", ss = "00"] = iso;
    local = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${mm}:${ss}`;
  } else if (us) {
    const [, m, d, y, hh = "0", mm = "00", ss = "00", meridiem] = us;
    local = `${y}-${pad(m)}-${pad(d)}T${pad(toHour24(hh, meridiem))}:${mm}:${ss}`;
  }
  if (!local) return null;

  const date = fromZonedTime(local, STUDIO_TIMEZONE);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Minimal flag parsing: positional args, `--flag`, and `--flag value`. */
export function parseArgs(argv: string[], valueFlags: string[]) {
  const positional: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (valueFlags.includes(name)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`--${name} needs a value`);
      }
      values.set(name, next);
      i++;
    } else {
      flags.add(name);
    }
  }
  return { positional, flags, values };
}
