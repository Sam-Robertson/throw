import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { freezeTermsFor } from "@/lib/membershipFreeze";
import { FREEZE_MONTHS, formatCents } from "@/lib/membershipLifecycle";
import { Button } from "@/components/site/Button";
import { CheckCircleIcon } from "@/components/site/icons";

export const dynamic = "force-dynamic";

/** "Membership paused" (design files): the confirmation after Pause for $5. */
export default async function PauseConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ emailed?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/manage");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] }, pausedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { plan: true, user: { select: { email: true } } },
  });
  if (!membership?.pausedAt) redirect("/membership/manage");

  const terms = await freezeTermsFor(membership);
  const { emailed } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10 md:py-14">
      <div className="text-center">
        <CheckCircleIcon className="text-sage mx-auto size-9" />
        <h1 className="text-headline mt-3 text-2xl font-bold">Membership paused</h1>
        {emailed === "1" ? (
          <p className="t-body-sm text-body mt-3">
            A confirmation email is on its way to
            <br />
            <span className="text-headline font-bold">{membership.user.email}</span>
          </p>
        ) : (
          <p className="t-body-sm text-body mt-3">
            Your {membership.plan.name} membership pauses on {formatMountainTime(membership.pausedAt, "date")}.
          </p>
        )}
      </div>

      <div className="mt-10">
        <h2 className="t-body-sm-bold text-headline">Order summary</h2>
        <p className="t-body-sm-bold text-body mt-3">Pause membership</p>
        <p className="t-body-sm text-body mt-1">
          Your pause starts {formatMountainTime(membership.pausedAt, "date")}. Your normal subscription
          billing will resume automatically after {FREEZE_MONTHS} months
          {membership.resumesAt ? `, on ${formatMountainTime(membership.resumesAt, "date")}` : ""}.
        </p>
        <div className="border-fill mt-5 flex items-center justify-between border-t pt-4">
          <span className="t-body-sm-bold text-headline">Monthly fee while paused</span>
          <span className="t-body-sm-bold text-headline">{formatCents(terms.monthlyFeeCents)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="t-body-sm text-body">Store credit per paused month</span>
          <span className="t-body-sm text-body">{formatCents(terms.creditCentsPerFrozenMonth)}</span>
        </div>
      </div>

      <Button href="/membership/manage" block className="mt-10">
        Back to my membership
      </Button>
    </div>
  );
}
