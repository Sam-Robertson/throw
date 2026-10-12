import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { freezeCreditEarnedCents } from "@/lib/membershipFreeze";
import {
  CANCEL_CUTOFF_DAY,
  cancelEndsAt,
  formatCents,
  isCancelReason,
  mountainDayOfMonth,
} from "@/lib/membershipLifecycle";
import { CancelConfirmButton } from "./_components/CancelConfirmButton";

export const dynamic = "force-dynamic";

/** "Cancelling your subscription" (design files): the terms, then the button that does it. */
export default async function CancelConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/cancel");

  const { reason } = await searchParams;
  if (!isCancelReason(reason)) redirect("/membership/cancel");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { billingIntervalDays: true, forfeitsRateOnCancelOrFreeze: true } } },
  });
  if (!membership) redirect("/membership/pick");
  if (membership.cancelAt) redirect("/membership/manage");

  const now = new Date();
  const paused = membership.status === "PAUSED" && membership.pausedAt !== null;
  const inCommitment = membership.commitmentEndsAt !== null && membership.commitmentEndsAt > now;
  const endsAt = paused
    ? membership.currentPeriodEnd
    : cancelEndsAt({
        now,
        currentPeriodEnd: membership.currentPeriodEnd,
        billingIntervalDays: membership.plan.billingIntervalDays,
      });
  const earnedCents = paused ? await freezeCreditEarnedCents(membership.id) : 0;
  const today = mountainDayOfMonth(now);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">Cancelling your subscription</h1>

      <ul className="t-body-sm text-body mt-6 list-disc space-y-4 pl-5">
        {paused ? (
          <>
            <li>
              Your membership is paused, so it ends with the current paused month on{" "}
              {formatMountainTime(endsAt, "date")}. You won&apos;t be charged again.
            </li>
            <li>
              Cancelling while paused forfeits the store credit the pause has earned
              {earnedCents > 0 ? ` (${formatCents(earnedCents)})` : ""}.
            </li>
          </>
        ) : (
          <>
            <li>
              Cancel by the {CANCEL_CUTOFF_DAY}th and your membership ends at the end of this month. You
              won&apos;t be charged again.
            </li>
            <li>
              Cancel after the {CANCEL_CUTOFF_DAY}th and you&apos;ll be billed for one more month. Your
              membership ends at the end of next month.
            </li>
            <li>
              Today is the {ordinal(today)}, so your membership would end on {formatMountainTime(endsAt, "date")}.
            </li>
          </>
        )}
        {membership.plan.forfeitsRateOnCancelOrFreeze && (
          <li>Cancelling gives up your founding rate. Rejoining later is at the standard price.</li>
        )}
        {inCommitment && membership.commitmentEndsAt && (
          <li>
            Your membership has a commitment through {formatMountainTime(membership.commitmentEndsAt, "date")},
            so it can&apos;t be cancelled online until then. Talk to the studio if something has changed.
          </li>
        )}
      </ul>

      <CancelConfirmButton reason={reason} disabled={inCommitment} />
    </div>
  );
}

function ordinal(day: number): string {
  const rem10 = day % 10;
  const rem100 = day % 100;
  const suffix =
    rem10 === 1 && rem100 !== 11 ? "st" : rem10 === 2 && rem100 !== 12 ? "nd" : rem10 === 3 && rem100 !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}
