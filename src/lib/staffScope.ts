import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, resolveLocationScope, type LocationScope } from "@/lib/locationScope";

/**
 * Server-only companions to src/lib/locationScope.ts (kept separate because
 * this file imports auth/prisma, which must never reach a client bundle).
 */

export type StaffScopeResult =
  | { error: NextResponse; session: null; scope: null }
  | { error: null; session: Session; scope: LocationScope };

/**
 * The requireStaff() guard from the admin routes, plus location scoping:
 * 401 without a session, 403 for non-staff or a location the STAFF user isn't
 * assigned to. `requested` is usually the `?locationId=` query param.
 */
export async function requireStaffScope(requested?: string | null): Promise<StaffScopeResult> {
  const session = await auth();
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
      scope: null,
    };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      scope: null,
    };
  try {
    return { error: null, session, scope: resolveLocationScope(session, requested) };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return {
        error: NextResponse.json({ error: err.message }, { status: 403 }),
        session: null,
        scope: null,
      };
    }
    throw err;
  }
}

/**
 * Customers a scope may see: anyone with a booking at a scoped studio, a
 * membership tied to one (directly or through its plan), or no bookings at all
 * — a walk-in who has never booked has to be findable from any front desk.
 */
export function customerScopeWhere(scope: LocationScope): Prisma.UserWhereInput {
  if (scope.locationIds === null) return {};
  const ids = scope.locationIds;
  if (ids.length === 0) return { id: { in: [] } };
  return {
    OR: [
      { bookings: { none: {} } },
      { bookings: { some: { studioSession: { locationId: { in: ids } } } } },
      {
        memberships: {
          some: { OR: [{ locationId: { in: ids } }, { plan: { locationId: { in: ids } } }] },
        },
      },
    ],
  };
}

export async function customerVisible(scope: LocationScope, userId: string): Promise<boolean> {
  if (scope.locationIds === null) return true;
  const count = await prisma.user.count({
    where: { id: userId, AND: [customerScopeWhere(scope)] },
  });
  return count > 0;
}

/**
 * Memberships a scope may see: those tied to a scoped studio directly or via
 * the plan. Memberships with no location on either (the Momence imports —
 * 445 of 449 at launch) are visible to every scope, like unassigned
 * conversations; hiding them would make a studio's member counts near zero.
 */
export function membershipScopeWhere(scope: LocationScope): Prisma.MembershipWhereInput {
  if (scope.locationIds === null) return {};
  const ids = scope.locationIds;
  if (ids.length === 0) return { id: { in: [] } };
  return {
    OR: [
      { locationId: { in: ids } },
      { plan: { locationId: { in: ids } } },
      { locationId: null, plan: { locationId: null } },
    ],
  };
}
