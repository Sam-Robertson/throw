import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shortLocationName } from "@/lib/locationName";
import { PURCHASABLE_PLAN_WHERE, getCapGroupUsage } from "@/lib/membershipCatalog";
import { formatDollarsShort, shelfLine, shortPeriodLabel, ticketsLine } from "@/lib/membershipLifecycle";
import { PlanPicker } from "./_components/PlanPicker";

export const dynamic = "force-dynamic";

/**
 * "Pick a membership" (design files): the plans as option cards, Continue
 * goes to that plan's checkout. The public /membership page is the
 * comparison table for visitors; this is the short list for a signed-in
 * customer without a membership (the account page and My membership send
 * them here).
 */
export default async function PickMembershipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/pick");

  const current = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true },
  });
  if (current) redirect("/membership/manage");

  const allPlans = await prisma.membershipPlan.findMany({
    where: PURCHASABLE_PLAN_WHERE,
    orderBy: [{ isFounding: "desc" }, { price: "asc" }],
    include: { location: { select: { id: true, name: true, address: true, createdAt: true } } },
  });
  // A capped plan (founding rates) disappears once its cap group is full.
  const capUsage = await getCapGroupUsage(allPlans.flatMap((p) => (p.capGroupId ? [p.capGroupId] : [])));
  const plans = allPlans.filter((p) => !p.capGroupId || (capUsage.get(p.capGroupId)?.remaining ?? 1) > 0);

  // The last studio this customer belonged to is the one they see first.
  const lastMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, locationId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { locationId: true },
  });

  const studioIds = [...new Set(plans.map((p) => p.location?.id ?? "none"))];
  const studios = studioIds
    .map((id) => {
      const studioPlans = plans.filter((p) => (p.location?.id ?? "none") === id);
      const location = studioPlans[0].location;
      return {
        id,
        name: location ? shortLocationName(location.name, location.address) : "All studios",
        createdAt: location?.createdAt.getTime() ?? 0,
        plans: studioPlans.map((p) => ({
          id: p.id,
          label: p.name,
          price: `${formatDollarsShort(p.price)} / ${shortPeriodLabel(p.billingIntervalDays)}`,
          subhead: [shelfLine(p.shelfType), ticketsLine(p.classTicketsPerPeriod)],
        })),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">Pick a membership</h1>
      {studios.length === 0 ? (
        <p className="t-body-sm text-body mt-6">No membership plans are on sale right now.</p>
      ) : (
        <PlanPicker studios={studios} initialStudioId={lastMembership?.locationId ?? studios[0].id} />
      )}
    </div>
  );
}
