import { addMonths } from "date-fns";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { defaultStudioLocationId } from "@/lib/locations";
import { grantPeriodAllowance } from "@/lib/credits";
import { sendInngestEvent } from "@/lib/inngest";
import { GUEST_PASS_ADD_ON_SLUG } from "@/lib/membershipCatalog";

/**
 * The Membership row for a new Stripe subscription, plus everything that goes
 * with it: the CREATED event, the first period's ticket allowance, the
 * welcome text (membership/created) and an included guest pass. Called by the
 * Stripe webhook (customer.subscription.created) for online sign-ups, and by
 * the register right after it creates a subscription at the desk, so the
 * membership exists whichever arrives first. The subscription id is unique on
 * Membership, so the second caller finds the row and does nothing.
 *
 * Returns the membership, or null when the subscription carries no
 * userId/planId metadata (not one of ours).
 */
export async function createMembershipFromSubscription(subscription: Stripe.Subscription) {
  const { userId, planId, joiningFeeCharged, commitmentTermId } = subscription.metadata ?? {};
  if (!userId || !planId) return null;

  const existing = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (existing) return existing;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const item = subscription.items.data[0];
  const currentPeriodStart = new Date(item.current_period_start * 1000);
  const currentPeriodEnd = new Date(item.current_period_end * 1000);
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  const locationId = plan?.locationId ?? (await defaultStudioLocationId()) ?? null;
  // The commitment term the customer chose (subscribe route, or the register).
  const term = commitmentTermId
    ? await prisma.commitmentTerm.findUnique({ where: { id: commitmentTermId } })
    : null;
  const commitmentMonths = term ? term.months : (plan?.commitmentMonths ?? null);

  let membership;
  try {
    membership = await prisma.membership.create({
      data: {
        userId,
        planId,
        locationId,
        status: "ACTIVE",
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        currentPeriodStart,
        currentPeriodEnd,
        creditsRemaining: 0,
        // The joining-fee decision is made once, where the sale happens (the
        // subscribe route or the register), and carried here in the
        // subscription metadata so the two never disagree.
        joiningFeePaid: joiningFeeCharged === "true",
        commitmentTermId: term?.id ?? null,
        commitmentEndsAt: commitmentMonths != null ? addMonths(currentPeriodStart, commitmentMonths) : null,
      },
    });
  } catch {
    // Lost the race to the other caller: the membership exists now.
    return prisma.membership.findUnique({ where: { stripeSubscriptionId: subscription.id } });
  }

  await prisma.membershipEvent.create({
    data: { membershipId: membership.id, eventType: "CREATED" },
  });
  await grantPeriodAllowance(membership.id, membership.currentPeriodStart, membership.currentPeriodEnd);
  await sendInngestEvent({
    name: "membership/created",
    data: { membershipId: membership.id, userId },
  });

  // A term can come with the guest pass (12 month): record it as an included
  // add-on, not a paid one. The term's free months are stored on
  // CommitmentTerm but no billing logic applies them yet.
  if (term?.includesGuestPass) {
    const guestPass = await prisma.membershipAddOn.findUnique({
      where: { slug: GUEST_PASS_ADD_ON_SLUG },
    });
    if (guestPass) {
      await prisma.membershipAddOnAssignment.create({
        data: { membershipId: membership.id, addOnId: guestPass.id, included: true },
      });
    } else {
      console.warn(
        `[membership] ${membership.id}: term includes a guest pass but no "${GUEST_PASS_ADD_ON_SLUG}" add-on exists`,
      );
    }
  }

  // Fire purchase conversion for a new membership.
  prisma.adTracking
    .findFirst({ where: { userId } })
    .then((t) => {
      if (t && !t.firstPurchaseAt) {
        prisma.adTracking
          .update({ where: { id: t.id }, data: { firstPurchaseAt: new Date() } })
          .catch(() => {});
      }
    })
    .catch(() => {});

  return membership;
}
