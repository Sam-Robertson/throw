import type { Prisma } from "@prisma/client";
import { CLASS_PRICE_SELECT, resolveClassPriceCents } from "@/lib/sellable";

// Shared by the collection and [id] routes.

export const sessionIncludes = {
  sessionType: {
    select: {
      ...CLASS_PRICE_SELECT,
      name: true,
      durationMinutes: true,
      capacity: true,
      priceUnit: true,
      isTicketEligible: true,
    },
  },
  instructor: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  _count: { select: { bookings: true } },
} satisfies Prisma.StudioSessionInclude;

export type SessionWithIncludes = Prisma.StudioSessionGetPayload<{ include: typeof sessionIncludes }>;

/** Adds what this session actually costs at its studio, and whether a ticket books it. */
export function presentSession(session: SessionWithIncludes) {
  return {
    ...session,
    priceCents: resolveClassPriceCents({
      sessionType: session.sessionType,
      locationId: session.locationId,
      priceCentsOverride: session.priceCentsOverride,
    }),
    isTicketEligible: session.isTicketEligibleOverride ?? session.sessionType.isTicketEligible,
  };
}

export type SessionOverrides = {
  title?: string | null;
  priceCentsOverride?: number | null;
  isTicketEligibleOverride?: boolean | null;
};

/**
 * Per-session overrides. Only keys present in `body` are returned; null or an
 * empty string clears the override so the class type's value applies again.
 */
export function parseSessionOverrides(
  body: Record<string, unknown>,
): { ok: true; value: SessionOverrides } | { ok: false; error: string } {
  const value: SessionOverrides = {};

  if (body.title !== undefined) {
    const title = body.title === null ? "" : String(body.title).trim();
    if (title.length > 120) return { ok: false, error: "title must be 120 characters or fewer" };
    value.title = title || null;
  }
  if (body.priceCentsOverride !== undefined) {
    if (body.priceCentsOverride === null || body.priceCentsOverride === "") value.priceCentsOverride = null;
    else {
      const cents = Number(body.priceCentsOverride);
      if (!Number.isInteger(cents) || cents < 0)
        return { ok: false, error: "priceCentsOverride must be a whole number of cents, 0 or more" };
      value.priceCentsOverride = cents;
    }
  }
  if (body.isTicketEligibleOverride !== undefined) {
    if (body.isTicketEligibleOverride !== null && typeof body.isTicketEligibleOverride !== "boolean")
      return { ok: false, error: "isTicketEligibleOverride must be true, false or null" };
    value.isTicketEligibleOverride = body.isTicketEligibleOverride;
  }
  return { ok: true, value };
}
