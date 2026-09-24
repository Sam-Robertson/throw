import { prisma } from "@/lib/prisma";
import { safeNext } from "@/lib/safeNext";
import { isWaiverKind, isWaiverScope, type WaiverKind, type WaiverScope } from "@/lib/waiverKinds";

/**
 * Which waivers apply, and whether a customer has signed them.
 *
 * A Waiver is one document (the class waiver, the membership agreement, a
 * workshop release) with a current WaiverVersion. It is either for one studio
 * or for every studio (locationId null). Its `kind` says when it is required:
 *
 *   CLASS       before booking or attending a class at that studio
 *   MEMBERSHIP  before starting a membership at that studio
 *   OTHER       never automatically; signed via its link or QR code
 *
 * A studio can require several waivers of one kind at once (its own plus an
 * all-studio one). Signing Provo's class waiver does not cover a Lehi booking.
 *
 * Within a kind, `appliesTo` narrows which bookings need it: every class
 * ("ALL"), events only, courses only, or chosen class types; every membership
 * plan or chosen plans. Callers that know what is being booked pass a
 * WaiverTarget; callers asking in general ("is this customer missing a class
 * waiver at Provo?") pass none and get the "ALL" waivers only.
 *
 * Class waivers keep a fallback: a studio with no class waiver of its own and
 * no all-studio one uses the most recently published active class waiver at
 * any studio, so a studio that hasn't published its own yet still requires one
 * rather than silently requiring none. Other kinds have no fallback.
 *
 * Server-only (imports Prisma).
 */

export { WAIVER_KINDS, WAIVER_KIND_LABELS, isWaiverKind, type WaiverKind } from "@/lib/waiverKinds";

/**
 * What is being booked, so waivers scoped to part of a kind can be matched.
 * For a class: the session type and its kind ("EVENT" | "COURSE"). For a
 * membership: the plan.
 */
export interface WaiverTarget {
  sessionTypeId?: string;
  sessionKind?: string;
  planId?: string;
}

export interface ApplicableWaiver {
  /** The WaiverVersion id — what signatures and sign links refer to. */
  id: string;
  waiverId: string;
  name: string;
  kind: WaiverKind;
  /** Null when the waiver applies at every studio. */
  locationId: string | null;
  locationName: string | null;
  content: string;
  version: number;
  appliesTo: WaiverScope;
  /** True when the requested studio had no class waiver and another studio's was used. */
  isFallback: boolean;
}

const waiverSelect = {
  id: true,
  locationId: true,
  content: true,
  version: true,
  isActive: true,
  publishedAt: true,
  location: { select: { name: true } },
  waiver: {
    select: {
      id: true,
      name: true,
      kind: true,
      locationId: true,
      archivedAt: true,
      appliesTo: true,
      sessionTypes: { select: { sessionTypeId: true } },
      plans: { select: { planId: true } },
    },
  },
} as const;

type SelectedVersion = {
  id: string;
  locationId: string | null;
  content: string;
  version: number;
  isActive: boolean;
  publishedAt: Date;
  location: { name: string } | null;
  waiver: {
    id: string;
    name: string;
    kind: string;
    locationId: string | null;
    archivedAt: Date | null;
    appliesTo: string;
    sessionTypes: { sessionTypeId: string }[];
    plans: { planId: string }[];
  } | null;
};

/** Whether a waiver's `appliesTo` covers what is being booked. No target means only "ALL" waivers. */
function appliesToTarget(v: SelectedVersion, target: WaiverTarget | undefined): boolean {
  const scope = v.waiver?.appliesTo ?? "ALL";
  switch (scope) {
    case "ALL":
      return true;
    case "EVENTS":
      return target?.sessionKind === "EVENT";
    case "COURSES":
      return target?.sessionKind === "COURSE";
    case "SELECTED":
      if (target?.sessionTypeId && v.waiver?.sessionTypes.some((t) => t.sessionTypeId === target.sessionTypeId))
        return true;
      if (target?.planId && v.waiver?.plans.some((p) => p.planId === target.planId)) return true;
      return false;
    default:
      return true;
  }
}

function toApplicable(v: SelectedVersion, isFallback: boolean): ApplicableWaiver {
  const kind = isWaiverKind(v.waiver?.kind) ? v.waiver.kind : "CLASS";
  const appliesTo: WaiverScope = isWaiverScope(kind, v.waiver?.appliesTo) ? v.waiver.appliesTo : "ALL";
  return {
    id: v.id,
    waiverId: v.waiver?.id ?? "",
    name: v.waiver?.name ?? (v.location ? `${v.location.name} waiver` : "Waiver"),
    kind,
    locationId: v.waiver?.locationId ?? v.locationId,
    locationName: v.location?.name ?? null,
    content: v.content,
    version: v.version,
    appliesTo,
    isFallback,
  };
}

/** Active, non-archived versions of `kind` that apply at `locationId` (studio-specific first). */
async function activeVersions(locationId: string | null, kind: WaiverKind): Promise<SelectedVersion[]> {
  return prisma.waiverVersion.findMany({
    where: {
      isActive: true,
      waiver: {
        kind,
        archivedAt: null,
        OR: locationId ? [{ locationId }, { locationId: null }] : [{ locationId: null }],
      },
    },
    orderBy: [{ locationId: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }],
    select: waiverSelect,
  });
}

/**
 * Every waiver of `kind` a customer must have signed at `locationId` for
 * `target`. Empty when none is required. Class waivers fall back to another
 * studio's (see above) only when the studio has no class waiver at all; a
 * studio whose class waivers just don't cover this booking requires none. A
 * session with no studio gets the all-studio class waivers, or the fallback.
 */
export async function getApplicableWaivers(
  locationId: string | null,
  kind: WaiverKind = "CLASS",
  target?: WaiverTarget,
): Promise<ApplicableWaiver[]> {
  const own = await activeVersions(locationId, kind);
  if (own.length > 0) return own.filter((v) => appliesToTarget(v, target)).map((v) => toApplicable(v, false));
  if (kind !== "CLASS") return [];

  const fallback = await prisma.waiverVersion.findFirst({
    where: { isActive: true, waiver: { kind: "CLASS", archivedAt: null, appliesTo: "ALL" } },
    orderBy: { publishedAt: "desc" },
    select: waiverSelect,
  });
  return fallback ? [toApplicable(fallback, true)] : [];
}

/** The first class waiver for `locationId`, or the fallback. Null only if no studio has one. */
export async function getApplicableWaiver(
  locationId: string | null,
  kind: WaiverKind = "CLASS",
  target?: WaiverTarget,
): Promise<ApplicableWaiver | null> {
  return (await getApplicableWaivers(locationId, kind, target))[0] ?? null;
}

/**
 * Resolves a waiver link's `versionId`. An active version is used as-is; a
 * stale link to a superseded version resolves to that waiver's current
 * version. A link to an archived or unknown waiver resolves like "no studio".
 */
export async function resolveWaiverForVersion(
  versionId: string,
): Promise<ApplicableWaiver | null> {
  const version = await prisma.waiverVersion.findUnique({
    where: { id: versionId },
    select: waiverSelect,
  });
  if (version?.isActive && !version.waiver?.archivedAt) return toApplicable(version, false);
  if (version?.waiver && !version.waiver.archivedAt) {
    const current = await resolveWaiverById(version.waiver.id);
    if (current) return current;
  }
  return getApplicableWaiver(version?.waiver?.locationId ?? version?.locationId ?? null);
}

/** The current version of one waiver (for `/waiver?waiverId=…` links and QR codes). */
export async function resolveWaiverById(waiverId: string): Promise<ApplicableWaiver | null> {
  const version = await prisma.waiverVersion.findFirst({
    where: { waiverId, isActive: true, waiver: { archivedAt: null } },
    orderBy: { publishedAt: "desc" },
    select: waiverSelect,
  });
  return version ? toApplicable(version, false) : null;
}

export async function hasSignedWaiver(userId: string, waiverVersionId: string): Promise<boolean> {
  const signature = await prisma.waiverSignature.findUnique({
    where: { userId_waiverVersionId: { userId, waiverVersionId } },
    select: { id: true },
  });
  return signature !== null;
}

/** The waivers of `kind` this user must still sign at `locationId` for `target`, in the order to sign them. */
export async function findUnsignedWaivers(
  userId: string,
  locationId: string | null,
  kind: WaiverKind = "CLASS",
  target?: WaiverTarget,
): Promise<ApplicableWaiver[]> {
  const waivers = await getApplicableWaivers(locationId, kind, target);
  if (waivers.length === 0) return [];
  const signed = await prisma.waiverSignature.findMany({
    where: { userId, waiverVersionId: { in: waivers.map((w) => w.id) } },
    select: { waiverVersionId: true },
  });
  const signedIds = new Set(signed.map((s) => s.waiverVersionId));
  return waivers.filter((w) => !signedIds.has(w.id));
}

/** The next waiver this user must sign before booking at `locationId`, or null if none is needed. */
export async function findUnsignedWaiver(
  userId: string,
  locationId: string | null,
  kind: WaiverKind = "CLASS",
  target?: WaiverTarget,
): Promise<ApplicableWaiver | null> {
  return (await findUnsignedWaivers(userId, locationId, kind, target))[0] ?? null;
}

/**
 * Link to the signing page for a specific waiver version, returning to
 * `callbackUrl`. When several waivers are required, send the customer back to
 * the page that checked, which then sends them on to the next one.
 */
export function waiverSignUrl(waiverVersionId: string, callbackUrl: string): string {
  const params = new URLSearchParams({ versionId: waiverVersionId, callbackUrl });
  return `/waiver?${params.toString()}`;
}

/** Link to sign whatever version of one waiver is current — stable enough to print on a QR code. */
export function waiverLinkForWaiver(waiverId: string, callbackUrl = "/account"): string {
  const params = new URLSearchParams({ waiverId, callbackUrl });
  return `/waiver?${params.toString()}`;
}

/**
 * Only same-site relative paths are allowed as post-signing redirects, so a
 * crafted /waiver?callbackUrl=https://… link can't bounce users off-site.
 */
export function safeCallbackUrl(callbackUrl: string | null | undefined, fallback = "/schedule"): string {
  return safeNext(callbackUrl, fallback);
}
