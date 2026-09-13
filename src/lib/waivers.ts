import { prisma } from "@/lib/prisma";

/**
 * Which waiver applies to a booking, and whether a customer has signed it.
 *
 * Waivers are per location: signing Provo's waiver does not cover a Lehi
 * booking. A location with no active WaiverVersion of its own (and a session
 * with no location at all) falls back to the most recently published active
 * version at any location, so a studio that hasn't published its own waiver
 * yet still requires one rather than silently requiring none.
 *
 * Server-only (imports Prisma).
 */

export interface ApplicableWaiver {
  id: string;
  locationId: string;
  locationName: string;
  content: string;
  version: number;
  /** True when the requested location had no active version and another location's was used. */
  isFallback: boolean;
}

const waiverSelect = {
  id: true,
  locationId: true,
  content: true,
  version: true,
  location: { select: { name: true } },
} as const;

type SelectedWaiver = {
  id: string;
  locationId: string;
  content: string;
  version: number;
  location: { name: string };
};

function toApplicable(w: SelectedWaiver, isFallback: boolean): ApplicableWaiver {
  return {
    id: w.id,
    locationId: w.locationId,
    locationName: w.location.name,
    content: w.content,
    version: w.version,
    isFallback,
  };
}

/** The active waiver for `locationId`, or the fallback. Null only if no location has an active waiver. */
export async function getApplicableWaiver(
  locationId: string | null,
): Promise<ApplicableWaiver | null> {
  if (locationId) {
    const own = await prisma.waiverVersion.findFirst({
      where: { locationId, isActive: true },
      orderBy: { publishedAt: "desc" },
      select: waiverSelect,
    });
    if (own) return toApplicable(own, false);
  }

  const fallback = await prisma.waiverVersion.findFirst({
    where: { isActive: true },
    orderBy: { publishedAt: "desc" },
    select: waiverSelect,
  });
  return fallback ? toApplicable(fallback, true) : null;
}

/**
 * Resolves a waiver link's `versionId`. An active version is used as-is; a
 * stale link to a superseded version resolves to whatever now applies at that
 * version's location. Unknown ids resolve like "no location".
 */
export async function resolveWaiverForVersion(
  versionId: string,
): Promise<ApplicableWaiver | null> {
  const version = await prisma.waiverVersion.findUnique({
    where: { id: versionId },
    select: { ...waiverSelect, isActive: true },
  });
  if (version?.isActive) return toApplicable(version, false);
  return getApplicableWaiver(version?.locationId ?? null);
}

export async function hasSignedWaiver(userId: string, waiverVersionId: string): Promise<boolean> {
  const signature = await prisma.waiverSignature.findUnique({
    where: { userId_waiverVersionId: { userId, waiverVersionId } },
    select: { id: true },
  });
  return signature !== null;
}

/** The waiver this user must still sign before booking at `locationId`, or null if none is needed. */
export async function findUnsignedWaiver(
  userId: string,
  locationId: string | null,
): Promise<ApplicableWaiver | null> {
  const waiver = await getApplicableWaiver(locationId);
  if (!waiver) return null;
  return (await hasSignedWaiver(userId, waiver.id)) ? null : waiver;
}

/** Link to the signing page for a specific waiver version, returning to `callbackUrl`. */
export function waiverSignUrl(waiverVersionId: string, callbackUrl: string): string {
  const params = new URLSearchParams({ versionId: waiverVersionId, callbackUrl });
  return `/waiver?${params.toString()}`;
}

/**
 * Only same-site relative paths are allowed as post-signing redirects, so a
 * crafted /waiver?callbackUrl=https://… link can't bounce users off-site.
 */
export function safeCallbackUrl(callbackUrl: string | null | undefined, fallback = "/schedule"): string {
  if (!callbackUrl) return fallback;
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//") || callbackUrl.startsWith("/\\")) {
    return fallback;
  }
  return callbackUrl;
}
