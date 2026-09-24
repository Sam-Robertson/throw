import { isWaiverScope, scopesForKind, type WaiverKind, type WaiverScope } from "@/lib/waiverKinds";

// What the admin waiver routes return: a waiver with every version, newest first.
export const WAIVER_ADMIN_SELECT = {
  id: true,
  name: true,
  kind: true,
  locationId: true,
  appliesTo: true,
  description: true,
  archivedAt: true,
  createdAt: true,
  location: { select: { id: true, name: true, address: true } },
  sessionTypes: { select: { sessionType: { select: { id: true, name: true, kind: true } } } },
  plans: { select: { plan: { select: { id: true, name: true } } } },
  versions: {
    orderBy: { version: "desc" as const },
    select: {
      id: true,
      version: true,
      publishedAt: true,
      isActive: true,
      content: true,
      _count: { select: { signatures: true } },
    },
  },
} as const;

/**
 * Reads `appliesTo`, `sessionTypeIds` and `planIds` from a create/update body
 * and checks them against the kind. Returns an error message or the parsed
 * scope; `sessionTypeIds`/`planIds` are the ids to link (only for SELECTED).
 */
export function parseScope(
  kind: WaiverKind,
  body: { appliesTo?: unknown; sessionTypeIds?: unknown; planIds?: unknown },
): { error: string } | { appliesTo: WaiverScope; sessionTypeIds: string[]; planIds: string[] } {
  const appliesTo = body.appliesTo === undefined ? "ALL" : body.appliesTo;
  if (!isWaiverScope(kind, appliesTo)) {
    return { error: `appliesTo must be one of ${scopesForKind(kind).join(", ")} for a ${kind} waiver` };
  }
  const ids = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : [];
  const sessionTypeIds = kind === "CLASS" && appliesTo === "SELECTED" ? ids(body.sessionTypeIds) : [];
  const planIds = kind === "MEMBERSHIP" && appliesTo === "SELECTED" ? ids(body.planIds) : [];
  if (appliesTo === "SELECTED" && sessionTypeIds.length === 0 && planIds.length === 0) {
    return { error: kind === "CLASS" ? "Choose at least one class type" : "Choose at least one membership plan" };
  }
  return { appliesTo, sessionTypeIds, planIds };
}
