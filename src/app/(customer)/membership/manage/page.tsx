import NextLink from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { getTicketBalance } from "@/lib/credits";
import { freezeCreditEarnedCents, freezeTermsFor, isPausePending } from "@/lib/membershipFreeze";
import {
  formatCents,
  formatDollarsShort,
  shelfLine,
  shortPeriodLabel,
  ticketsLine,
} from "@/lib/membershipLifecycle";
import {
  CalendarCheckIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRight,
  PauseCircleIcon,
  RosetteIcon,
} from "@/components/site/icons";
import { MembershipAction } from "./_components/MembershipAction";

export const dynamic = "force-dynamic";

/**
 * "My membership" (design files: Memberships). One card for the plan, the
 * benefits under it, then the Pause and Cancel rows. A paused membership
 * shows the freeze card, what the pause is earning, and a Restart button.
 */
export default async function ManageMembershipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/manage");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: true, shelfSpace: { select: { number: true } } },
  });
  if (!membership) redirect("/membership/pick");

  const paused = membership.status === "PAUSED" && membership.pausedAt !== null;
  const pausePending = isPausePending(membership);
  const cancelling = membership.cancelAt !== null;
  const [tickets, terms, earnedCents] = await Promise.all([
    getTicketBalance(membership.id),
    freezeTermsFor(membership),
    paused ? freezeCreditEarnedCents(membership.id) : Promise.resolve(0),
  ]);

  const plan = membership.plan;
  const perks = Array.isArray(plan.perks) ? (plan.perks as string[]) : [];
  const priceLabel = `${formatDollarsShort(plan.price)} / ${shortPeriodLabel(plan.billingIntervalDays)}`;
  const planTitle = /membership/i.test(plan.name) ? plan.name : `${plan.name} membership`;
  const shelf = membership.shelfSpace
    ? `${shelfLine(plan.shelfType)} · #${membership.shelfSpace.number}`
    : shelfLine(plan.shelfType);
  const ticketsAllowance = tickets.unlimited ? "Unlimited class tickets" : ticketsLine(plan.classTicketsPerPeriod);
  const ticketsLeft = tickets.unlimited
    ? null
    : `${Math.max(0, tickets.balance ?? 0)} left until ${formatMountainTime(membership.currentPeriodEnd, "date")}`;

  const chip = cancelling
    ? { label: "Cancelling", className: "border-rust/50 bg-rust/10" }
    : paused
      ? { label: "Paused", className: "border-terracotta/50 bg-[#fdf1e4]" }
      : pausePending
        ? { label: "Pausing", className: "border-sage-stroke bg-white" }
        : null;

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">My membership</h1>

      {/* Plan card */}
      <div
        className={
          paused || cancelling
            ? "border-sage-stroke mt-6 rounded-[24px] border bg-white p-5"
            : "border-sage-stroke bg-sage-fill mt-6 rounded-[24px] border p-5"
        }
      >
        <div className="flex items-start gap-3">
          {paused ? (
            <PauseCircleIcon className="text-headline mt-0.5 size-7 shrink-0" />
          ) : (
            <CheckCircleIcon className="text-sage mt-0.5 size-7 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="t-body-sm-bold text-headline">{paused ? planTitle : plan.name}</span>
              {chip ? (
                <span
                  className={`text-headline shrink-0 rounded-full border px-3 py-1 text-sm font-bold ${chip.className}`}
                >
                  {chip.label}
                </span>
              ) : (
                <span className="t-body-sm-bold text-headline shrink-0">{priceLabel}</span>
              )}
            </div>
            {paused ? (
              <>
                <p className="t-body-sm text-body mt-1">
                  Paused since {formatMountainTime(membership.pausedAt!, "date")}
                </p>
                <p className="t-body-sm text-body">{formatDollarsShort(terms.monthlyFeeCents)} / month</p>
                {cancelling && (
                  <p className="t-body-sm text-body">Ends {formatMountainTime(membership.cancelAt!, "date")}</p>
                )}
              </>
            ) : (
              <>
                <p className="t-body-sm text-body mt-1">{shelf}</p>
                <p className="t-body-sm text-body">{ticketsAllowance}</p>
                {chip && <p className="t-body-sm text-body">{priceLabel}</p>}
                {cancelling && (
                  <p className="t-body-sm text-body">Ends {formatMountainTime(membership.cancelAt!, "date")}</p>
                )}
                {pausePending && !cancelling && (
                  <p className="t-body-sm text-body">
                    Pauses {formatMountainTime(membership.pausedAt!, "date")}, then{" "}
                    {formatDollarsShort(terms.monthlyFeeCents)} / month
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {!paused && !cancelling && !pausePending && (
        <p className="text-details mt-3 text-sm">
          Renews {formatMountainTime(membership.currentPeriodEnd, "date")}
        </p>
      )}

      {/* Benefits */}
      <h2 className="text-headline mt-8 text-2xl font-bold">Your benefits</h2>
      <ul className="mt-4 space-y-4">
        {paused ? (
          <>
            <Benefit>
              {formatDollarsShort(terms.creditCentsPerFrozenMonth)} of in store credit for every month you stay
              paused
            </Benefit>
            <Benefit>You’ve earned {formatCents(earnedCents)} of in store credit so far</Benefit>
            {membership.resumesAt && !cancelling && (
              <Benefit>
                Normal billing resumes on its own on {formatMountainTime(membership.resumesAt, "date")}
              </Benefit>
            )}
          </>
        ) : (
          <>
            {perks.map((perk) => (
              <Benefit key={perk}>{perk}</Benefit>
            ))}
            <Benefit sub={ticketsLeft ?? "Reserve a wheel even when a class is in session"}>
              {ticketsAllowance}
            </Benefit>
          </>
        )}
      </ul>

      {/* Actions */}
      <ul className="divide-fill mt-10 divide-y">
        {!paused && !pausePending && !cancelling && (
          <li>
            <ActionRow href="/membership/pause" icon={<CalendarCheckIcon className="size-7" />}>
              Pause membership
            </ActionRow>
          </li>
        )}
        {!cancelling && (
          <li>
            <ActionRow href="/membership/cancel" icon={<RosetteIcon className="size-7" />}>
              Cancel membership
            </ActionRow>
          </li>
        )}
      </ul>

      {paused && (
        <MembershipAction action="resume" className="mt-8">
          Restart membership
        </MembershipAction>
      )}
      {pausePending && !cancelling && (
        <MembershipAction action="resume" variant="secondary" className="mt-8">
          Keep my membership going
        </MembershipAction>
      )}
      {cancelling && !paused && (
        <MembershipAction action="undo-cancel" variant="secondary" className="mt-8">
          Keep my membership
        </MembershipAction>
      )}
    </div>
  );
}

function Benefit({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <li className="flex items-start gap-4">
      <CheckIcon className="text-sage mt-1.5 size-5 shrink-0" />
      <span>
        <span className="t-body-lg text-body block md:text-base md:leading-7">{children}</span>
        {sub && <span className="text-body mt-0.5 block text-sm">{sub}</span>}
      </span>
    </li>
  );
}

function ActionRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NextLink href={href} className="text-headline flex items-center gap-4 py-5">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-xl font-bold">{children}</span>
      <ChevronRight className="size-5 shrink-0" />
    </NextLink>
  );
}
