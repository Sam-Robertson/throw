import type { Prisma } from "@prisma/client";
import { PURCHASABLE_PLAN_WHERE, getCapGroupUsage } from "@/lib/membershipCatalog";
import { ensureStripePriceForPlan } from "@/lib/stripePrices";

export const NOT_VISIBLE = { error: "This plan belongs to a studio you don't have access to" };

export const planInclude = {
  location: { select: { id: true, name: true } },
  capGroup: { select: { id: true, slug: true, name: true, cap: true } },
  _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.MembershipPlanInclude;

type PlanRow = Prisma.MembershipPlanGetPayload<{ include: typeof planInclude }>;

/** Adds `capGroup.sold`: memberships counted against the cap across every plan in the group. */
export async function withCapUsage<T extends PlanRow>(plans: T[]) {
  const usage = await getCapGroupUsage(plans.flatMap((p) => (p.capGroupId ? [p.capGroupId] : [])));
  return plans.map((plan) => ({
    ...plan,
    capGroup: plan.capGroup
      ? { ...plan.capGroup, sold: usage.get(plan.capGroup.id)?.sold ?? 0 }
      : null,
  }));
}

type SavedPlan = Pick<
  PlanRow,
  "id" | "slug" | "price" | "isActive" | "isPublic" | "isLegacy" | "archivedAt"
>;

function isPurchasable(plan: SavedPlan): boolean {
  return (
    plan.isActive === PURCHASABLE_PLAN_WHERE.isActive &&
    plan.isPublic === PURCHASABLE_PLAN_WHERE.isPublic &&
    plan.isLegacy === PURCHASABLE_PLAN_WHERE.isLegacy &&
    plan.archivedAt === null
  );
}

/**
 * Keeps the plan's Stripe Price in step after a save. Only plans that can be
 * bought online get one here; the subscribe route would create it at checkout
 * anyway, so a Stripe failure is reported as a warning and never fails the save.
 */
export async function syncStripePriceAfterSave(plan: SavedPlan): Promise<string | null> {
  if (!isPurchasable(plan) || plan.price <= 0) return null;
  try {
    await ensureStripePriceForPlan(plan.id);
    return null;
  } catch (err) {
    console.error(`[membership-plans] Stripe price sync failed for ${plan.slug}`, err);
    return "Saved, but the Stripe price could not be updated. It will be created at the next checkout.";
  }
}
