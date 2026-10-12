import { redirect } from "next/navigation";
import { addMonths } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { freezeTermsFor } from "@/lib/membershipFreeze";
import { FREEZE_MONTHS, MIN_TENURE_MONTHS, canPause, formatDollarsShort } from "@/lib/membershipLifecycle";
import { PauseForm } from "./_components/PauseForm";

export const dynamic = "force-dynamic";

/**
 * "Pausing your membership" (design files): the freeze terms, the agreement
 * checkbox, and "Pause for $5". The figures come from the studio's freeze
 * policy, so the copy and the charge can't disagree.
 */
export default async function PauseMembershipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/pause");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  if (!membership) redirect("/membership/pick");
  // Already paused, pausing, or cancelling: nothing to request here.
  if (membership.status === "PAUSED" || membership.pausedAt || membership.cancelAt) redirect("/membership/manage");

  const terms = await freezeTermsFor(membership);
  const fee = formatDollarsShort(terms.monthlyFeeCents);
  const credit = formatDollarsShort(terms.creditCentsPerFrozenMonth);
  const extraCents = terms.creditCentsPerFrozenMonth - terms.monthlyFeeCents;
  const threeMonths = formatDollarsShort(terms.creditCentsPerFrozenMonth * FREEZE_MONTHS);
  const eligible = canPause(membership.createdAt);
  const eligibleFrom = formatMountainTime(addMonths(membership.createdAt, MIN_TENURE_MONTHS), "date");
  const startsOn = formatMountainTime(membership.currentPeriodEnd, "date");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">Pausing your membership</h1>

      <div className="mt-6 space-y-6">
        <Section title="Who can freeze">Anyone who&apos;s been with us at least one full month.</Section>
        <Section title="What it costs">
          {fee} a month, for as long as you like.{" "}
          {extraCents > 0
            ? `Every dollar comes back as store credit, plus ${formatDollarsShort(extraCents)} extra a month.`
            : `Every paused month comes back as ${credit} of store credit.`}{" "}
          Pause for three months and you&apos;ll have {threeMonths} waiting.
        </Section>
        <Section title="About the credit">
          Store credit isn&apos;t cash. No refunds, it can&apos;t go toward dues, and if you cancel while paused,
          it&apos;s gone.
        </Section>
        <Section title="When to request to pause">
          Pause by 11:59 PM Mountain time on the last day of the month. Miss this deadline and you&apos;ll pay
          one more regular month before it takes effect. Requested today, your pause starts {startsOn} and
          normal billing resumes on its own after {FREEZE_MONTHS} months.
        </Section>
        {membership.plan.forfeitsRateOnCancelOrFreeze && (
          <Section title="Your founding rate">
            Pausing gives up your founding rate. When you restart you&apos;ll be on the standard price for your
            plan.
          </Section>
        )}
        {!eligible && (
          <Section title="Not just yet">
            You&apos;ve been with us since {formatMountainTime(membership.createdAt, "date")}, so you can pause
            from {eligibleFrom}.
          </Section>
        )}
      </div>

      <PauseForm fee={fee} eligible={eligible} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="t-body-sm-bold text-body">{title}</h2>
      <p className="t-body-sm text-body mt-1">{children}</p>
    </section>
  );
}
