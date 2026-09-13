import type { Session } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Server-side location scoping for admin/staff data.
 *
 * ADMIN is unrestricted (can optionally narrow to one location). STAFF is
 * limited to the locations in session.user.locationIds, which comes from their
 * StaffRoleAssignment rows at sign-in. A STAFF user with no assignment gets an
 * empty list and therefore sees nothing — deliberately not "everything".
 */

/** Sent by the admin location switcher to mean "every location". */
export const ALL_LOCATIONS = "__all__";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You don't have access to that location") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** `locationIds: null` means unrestricted. An empty array means no access. */
export interface LocationScope {
  locationIds: string[] | null;
}

export function resolveLocationScope(
  session: Session,
  requested?: string | null,
): LocationScope {
  const wanted = requested && requested !== ALL_LOCATIONS ? requested : null;
  const { role } = session.user;

  if (role === "ADMIN") {
    return { locationIds: wanted ? [wanted] : null };
  }

  if (role !== "STAFF") {
    throw new ForbiddenError("Staff access required");
  }

  const assigned = session.user.locationIds ?? [];
  if (wanted) {
    if (!assigned.includes(wanted)) throw new ForbiddenError();
    return { locationIds: [wanted] };
  }
  return { locationIds: assigned };
}

/**
 * Prisma where-fragment restricting `field` to the scope. Spread it into a
 * where clause: `where: { ...locationWhere(scope), status: "OPEN" }`.
 */
export function locationWhere<F extends string = "locationId">(
  scope: LocationScope,
  field?: F,
): { [K in F]?: { in: string[] } } {
  if (scope.locationIds === null) return {};
  const key = (field ?? "locationId") as F;
  return { [key]: { in: scope.locationIds } } as { [K in F]?: { in: string[] } };
}

/**
 * Like locationWhere, but rows whose field is null stay visible to every
 * scope (e.g. conversations from an unassigned SMS number).
 */
export function locationWhereOrUnassigned<F extends string = "locationId">(
  scope: LocationScope,
  field?: F,
): { OR?: Array<{ [K in F]: { in: string[] } | null }> } {
  if (scope.locationIds === null) return {};
  const key = (field ?? "locationId") as F;
  // No assigned locations means nothing at all — not even unassigned rows.
  if (scope.locationIds.length === 0) {
    const none: string[] = [];
    return { OR: [{ [key]: { in: none } } as { [K in F]: { in: string[] } }] };
  }
  return {
    OR: [
      { [key]: { in: scope.locationIds } } as { [K in F]: { in: string[] } },
      { [key]: null } as { [K in F]: null },
    ],
  };
}

/** True when the scope may see rows at `locationId`. */
export function scopeAllows(scope: LocationScope, locationId: string | null): boolean {
  if (scope.locationIds === null) return true;
  return locationId !== null && scope.locationIds.includes(locationId);
}

/**
 * Like scopeAllows, but a row with no location (null) is visible to any scope
 * that has at least one location — the single-row counterpart of
 * locationWhereOrUnassigned.
 */
export function scopeAllowsUnassigned(scope: LocationScope, locationId: string | null): boolean {
  if (scope.locationIds === null) return true;
  if (scope.locationIds.length === 0) return false;
  return locationId === null || scope.locationIds.includes(locationId);
}

/** Converts a ForbiddenError into the standard JSON 403; rethrows anything else. */
export function forbiddenResponse(err: unknown): NextResponse {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  throw err;
}
