import type { Prisma } from "@prisma/client";

// Shared by the collection and [id] routes: what a class type response
// includes, and parsing of the catalog fields (docs/throw-catalog.md section 2).

export const KINDS = ["EVENT", "COURSE"] as const;
export const PRICE_UNITS = ["PER_WHEEL", "PER_PERSON", "FLAT"] as const;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// A function, not a constant: the upcoming count is relative to "now".
export function sessionTypeInclude() {
  return {
    _count: {
      select: {
        studioSessions: { where: { startsAt: { gt: new Date() }, isCancelled: false } },
      },
    },
    location: { select: { id: true, name: true } },
    locationPrices: {
      select: { locationId: true, priceCents: true, memberPriceCents: true, isConfirmed: true },
    },
  } satisfies Prisma.SessionTypeInclude;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function cents(value: unknown, field: string): Parsed<number> {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return { ok: false, error: `${field} must be a whole number of cents, 0 or more` };
  return { ok: true, value: n };
}

function optionalInt(value: unknown, field: string, min: number): Parsed<number | null> {
  if (value === null || value === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) return { ok: false, error: `${field} must be a whole number of at least ${min}` };
  return { ok: true, value: n };
}

export type CatalogFields = {
  kind?: string;
  tags?: string[];
  priceUnit?: string;
  maxPeoplePerWheel?: number;
  allowsWheelSharing?: boolean;
  isTicketEligible?: boolean;
  membersOnly?: boolean;
  isPublic?: boolean;
  memberPriceCents?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
};

/** Only the catalog fields present in `body` are returned, so PATCH stays partial. */
export function parseCatalogFields(body: Record<string, unknown>): Parsed<CatalogFields> {
  const data: CatalogFields = {};

  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind as (typeof KINDS)[number]))
      return { ok: false, error: `kind must be one of ${KINDS.join(", ")}` };
    data.kind = String(body.kind);
  }
  if (body.priceUnit !== undefined) {
    if (!PRICE_UNITS.includes(body.priceUnit as (typeof PRICE_UNITS)[number]))
      return { ok: false, error: `priceUnit must be one of ${PRICE_UNITS.join(", ")}` };
    data.priceUnit = String(body.priceUnit);
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return { ok: false, error: "tags must be a list" };
    data.tags = [...new Set(body.tags.map((t) => slugify(String(t))).filter(Boolean))];
  }
  if (body.maxPeoplePerWheel !== undefined) {
    const n = Number(body.maxPeoplePerWheel);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: "maxPeoplePerWheel must be a whole number of at least 1" };
    data.maxPeoplePerWheel = n;
  }
  for (const key of ["allowsWheelSharing", "isTicketEligible", "membersOnly", "isPublic"] as const) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }
  if (body.memberPriceCents !== undefined) {
    if (body.memberPriceCents === null || body.memberPriceCents === "") data.memberPriceCents = null;
    else {
      const parsed = cents(body.memberPriceCents, "memberPriceCents");
      if (!parsed.ok) return parsed;
      data.memberPriceCents = parsed.value;
    }
  }
  for (const key of ["minAge", "maxAge"] as const) {
    if (body[key] !== undefined) {
      const parsed = optionalInt(body[key], key, 0);
      if (!parsed.ok) return parsed;
      data[key] = parsed.value;
    }
  }
  if (typeof data.minAge === "number" && typeof data.maxAge === "number" && data.minAge > data.maxAge)
    return { ok: false, error: "minAge can't be more than maxAge" };

  return { ok: true, value: data };
}

export type LocationPriceInput = {
  locationId: string;
  priceCents: number;
  memberPriceCents: number | null;
  isConfirmed: boolean;
};

/**
 * `locationPrices` is the full list of per-studio prices: studios left out
 * fall back to the class type's default price.
 */
export function parseLocationPrices(value: unknown): Parsed<LocationPriceInput[]> {
  if (!Array.isArray(value)) return { ok: false, error: "locationPrices must be a list" };
  const rows: LocationPriceInput[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    if (!raw || typeof raw.locationId !== "string" || !raw.locationId)
      return { ok: false, error: "Each studio price needs a locationId" };
    if (rows.some((r) => r.locationId === raw.locationId))
      return { ok: false, error: "A studio can only have one price" };
    const price = cents(raw.priceCents, "priceCents");
    if (!price.ok) return price;
    let memberPriceCents: number | null = null;
    if (raw.memberPriceCents !== undefined && raw.memberPriceCents !== null && raw.memberPriceCents !== "") {
      const member = cents(raw.memberPriceCents, "memberPriceCents");
      if (!member.ok) return member;
      memberPriceCents = member.value;
    }
    rows.push({
      locationId: raw.locationId,
      priceCents: price.value,
      memberPriceCents,
      isConfirmed: raw.isConfirmed === undefined ? true : Boolean(raw.isConfirmed),
    });
  }
  return { ok: true, value: rows };
}
