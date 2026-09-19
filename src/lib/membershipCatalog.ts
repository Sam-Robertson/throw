import type { MembershipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Single place that decides whether a membership plan can be bought online
 * (docs/throw-catalog.md section 4). Used by the public /membership page, the
 * subscribe page, the subscribe route and the admin plan list, so they can
 * never disagree.
 *
 * Legacy plans stay active so staff can assign them, but they are never
 * public. The POS never sells a subscription at all.
 */
export const PURCHASABLE_PLAN_WHERE = {
  isActive: true,
  isPublic: true,
  isLegacy: false,
  archivedAt: null,
} satisfies Prisma.MembershipPlanWhereInput;

/**
 * The add-on a commitment term with `includesGuestPass` comes with. Matched on
 * its slug, the same stable key scripts/sync-membership-plans.ts creates it under.
 */
export const GUEST_PASS_ADD_ON_SLUG = "guest-pass";

/** A frozen (PAUSED) membership still holds its place under a cap. */
export const CAP_COUNTED_STATUSES: MembershipStatus[] = ["ACTIVE", "PAUSED"];

export type PlanPurchaseBlockCode =
  | "PLAN_NOT_FOUND"
  | "PLAN_INACTIVE"
  | "PLAN_NOT_PUBLIC"
  | "PLAN_LEGACY"
  | "PLAN_SOLD_OUT";

const BLOCK_MESSAGES: Record<PlanPurchaseBlockCode, string> = {
  PLAN_NOT_FOUND: "Plan not found",
  PLAN_INACTIVE: "This plan is no longer offered",
  PLAN_NOT_PUBLIC: "This plan can't be purchased online",
  PLAN_LEGACY: "This plan is no longer sold. Ask the studio if you think you should be on it",
  PLAN_SOLD_OUT: "This plan is sold out",
};

export interface CapGroupUsage {
  cap: number;
  sold: number;
  remaining: number;
}

/**
 * Memberships sold against each cap group, counted across every plan in the
 * group ("50 founding members in total across the three tiers").
 */
export async function getCapGroupUsage(capGroupIds: string[]): Promise<Map<string, CapGroupUsage>> {
  const usage = new Map<string, CapGroupUsage>();
  const ids = [...new Set(capGroupIds)];
  if (ids.length === 0) return usage;

  const groups = await prisma.membershipCapGroup.findMany({
    where: { id: { in: ids } },
    select: { id: true, cap: true },
  });
  for (const group of groups) {
    const sold = await prisma.membership.count({
      where: { status: { in: CAP_COUNTED_STATUSES }, plan: { capGroupId: group.id } },
    });
    usage.set(group.id, { cap: group.cap, sold, remaining: Math.max(0, group.cap - sold) });
  }
  return usage;
}

type PurchaseCheckPlan = {
  isActive: boolean;
  isPublic: boolean;
  isLegacy: boolean;
  archivedAt: Date | null;
  capGroupId: string | null;
};

export type PlanPurchaseCheck<T> =
  | { ok: true; plan: T; capUsage: CapGroupUsage | null }
  | { ok: false; code: PlanPurchaseBlockCode; message: string; status: number };

function blocked(code: PlanPurchaseBlockCode, status: number) {
  return { ok: false as const, code, message: BLOCK_MESSAGES[code], status };
}

/** Whether `plan` may be bought online right now, and why not if it can't. */
export async function checkPlanPurchasable<T extends PurchaseCheckPlan>(
  plan: T | null,
): Promise<PlanPurchaseCheck<T>> {
  if (!plan) return blocked("PLAN_NOT_FOUND", 404);
  if (!plan.isActive || plan.archivedAt !== null) return blocked("PLAN_INACTIVE", 403);
  if (plan.isLegacy) return blocked("PLAN_LEGACY", 403);
  if (!plan.isPublic) return blocked("PLAN_NOT_PUBLIC", 403);

  if (!plan.capGroupId) return { ok: true, plan, capUsage: null };
  const capUsage = (await getCapGroupUsage([plan.capGroupId])).get(plan.capGroupId) ?? null;
  if (capUsage && capUsage.remaining <= 0) return blocked("PLAN_SOLD_OUT", 409);
  return { ok: true, plan, capUsage };
}
