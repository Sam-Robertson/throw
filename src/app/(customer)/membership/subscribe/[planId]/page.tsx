import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingPeriodLabel } from "@/lib/billingInterval";
import { checkPlanPurchasable } from "@/lib/membershipCatalog";
import { findUnsignedWaiver, waiverSignUrl } from "@/lib/waivers";
import { SubscribeForm } from "./_components/SubscribeForm";

export const dynamic = "force-dynamic";

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/membership`);
  }

  const { planId } = await params;

  // Same rule as the subscribe route: legacy, non-public and sold-out plans
  // can't be bought online, so there is nothing to show here.
  const purchasable = await checkPlanPurchasable(
    await prisma.membershipPlan.findUnique({ where: { id: planId } }),
  );
  if (!purchasable.ok) redirect("/membership");
  const { plan, capUsage } = purchasable;

  // A membership waiver (this studio's or an all-studio one) is signed before
  // the plan is chosen, so checkout never bounces back here.
  const unsignedWaiver = await findUnsignedWaiver(session.user.id, plan.locationId, "MEMBERSHIP", { planId: plan.id });
  if (unsignedWaiver) redirect(waiverSignUrl(unsignedWaiver.id, `/membership/subscribe/${planId}`));

  const terms = await prisma.commitmentTerm.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const priorMembershipCount = await prisma.membership.count({
    where: { userId: session.user.id },
  });
  const firstTimeMember = priorMembershipCount === 0;
  // With commitment terms set up, the joining fee comes from the chosen term.
  const chargePlanJoiningFee = terms.length === 0 && plan.joiningFeeCents > 0 && firstTimeMember;
  const period = billingPeriodLabel(plan.billingIntervalDays);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/membership"
        className="mb-8 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Memberships
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Start Membership</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{plan.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
          <p className="text-2xl font-bold">
            {formatDollars(plan.price)}
            <span className="text-base font-normal text-muted-foreground"> / {period}</span>
          </p>
          {capUsage && (
            <p className="text-sm font-medium">
              {capUsage.remaining} of {capUsage.cap} left
            </p>
          )}
          {plan.forfeitsRateOnCancelOrFreeze && (
            <p className="text-xs text-muted-foreground">
              This rate is lost if you cancel or freeze your membership.
            </p>
          )}
          {chargePlanJoiningFee && (
            <p className="text-sm">
              Plus a one-time{" "}
              <span className="font-semibold">{formatDollars(plan.joiningFeeCents)}</span> joining
              fee.
            </p>
          )}
          {plan.billingAnchorDay && (
            <p className="text-xs text-muted-foreground">
              You&apos;ll be charged a prorated amount today, then $
              {(plan.price / 100).toFixed(2)} on the {plan.billingAnchorDay}
              {plan.billingAnchorDay === 1 ? "st" : "th"} of each month.
            </p>
          )}
        </CardContent>
      </Card>
      <SubscribeForm
        planId={plan.id}
        firstTimeMember={firstTimeMember}
        terms={terms.map((t) => ({
          id: t.id,
          name: t.name,
          months: t.months,
          joiningFeeCents: t.joiningFeeCents,
          retailDiscountPercent: t.retailDiscountPercent,
          includesGuestPass: t.includesGuestPass,
          includesVideoLibrary: t.includesVideoLibrary,
          freeMonths: t.freeMonths,
        }))}
      />
    </main>
  );
}
