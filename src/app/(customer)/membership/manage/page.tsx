import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatMountainTime } from "@/lib/timezone";
import { getTicketBalance } from "@/lib/credits";
import { MembershipActions } from "./_components/MembershipActions";
import { PlanSwitcher } from "./_components/PlanSwitcher";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "outline",
};

const LEDGER_TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ALLOWANCE: "default",
  ROLLOVER: "secondary",
  BOOKING: "outline",
  REFUND: "secondary",
  ADJUSTMENT: "outline",
  EXPIRY: "destructive",
};

export default async function ManageMembershipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/manage");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      plan: true,
      membershipEvents: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!membership) redirect("/membership");

  const otherPlans =
    membership.status === "ACTIVE"
      ? await prisma.membershipPlan.findMany({
          where: { isActive: true, id: { not: membership.planId } },
          orderBy: { price: "asc" },
        })
      : [];

  const currentPeriodEndFormatted = formatMountainTime(
    membership.currentPeriodEnd,
    "date",
  );

  const ticketBalance = await getTicketBalance(membership.id);

  const shelfSpace = membership.plan.shelfType
    ? await prisma.shelfSpace.findUnique({ where: { membershipId: membership.id } })
    : null;

  const inCommitment =
    membership.commitmentEndsAt !== null && membership.commitmentEndsAt > new Date();
  const commitmentEndsAtFormatted = membership.commitmentEndsAt
    ? formatMountainTime(membership.commitmentEndsAt, "date")
    : null;

  const ledgerEntries = ticketBalance.unlimited
    ? []
    : await prisma.membershipCreditLedger.findMany({
        where: { membershipId: membership.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

  const bookingIds = [
    ...new Set(ledgerEntries.map((e) => e.bookingId).filter((id): id is string => !!id)),
  ];
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, studioSession: { select: { sessionType: { select: { name: true } } } } },
      })
    : [];
  const sessionNameByBookingId = new Map(bookings.map((b) => [b.id, b.studioSession.sessionType.name]));

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Manage Membership</h1>

      <div className="mb-6 rounded-lg border p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{membership.plan.name}</span>
          <Badge variant={STATUS_VARIANT[membership.status] ?? "outline"}>
            {membership.status}
          </Badge>
        </div>
        {membership.status === "ACTIVE" && (
          <p className="text-sm text-muted-foreground">
            Next billing date:{" "}
            <span className="font-medium text-foreground">
              {currentPeriodEndFormatted}
            </span>
          </p>
        )}
        {membership.status === "PAUSED" && membership.resumesAt && (
          <p className="text-sm text-muted-foreground">
            Access expires:{" "}
            <span className="font-medium text-foreground">
              {formatMountainTime(membership.currentPeriodEnd, "date")}
            </span>
            {" · "}
            Pause window ends:{" "}
            <span className="font-medium text-foreground">
              {formatMountainTime(membership.resumesAt, "date")}
            </span>
          </p>
        )}
        {inCommitment && commitmentEndsAtFormatted && (
          <p className="text-sm text-muted-foreground">
            Commitment through{" "}
            <span className="font-medium text-foreground">{commitmentEndsAtFormatted}</span>
          </p>
        )}
        {membership.plan.shelfType && (
          <p className="text-sm text-muted-foreground">
            Shelf space:{" "}
            {shelfSpace ? (
              <span className="font-medium text-foreground">#{shelfSpace.number}</span>
            ) : (
              <span className="font-medium text-foreground">
                No shelf assigned yet — ask staff at the studio.
              </span>
            )}
          </p>
        )}
      </div>

      <div className="mb-8 rounded-lg border p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Class Tickets
        </h2>
        {ticketBalance.unlimited ? (
          <p className="font-medium">Unlimited classes</p>
        ) : (
          <>
            <p className="font-medium">
              {Math.max(0, ticketBalance.balance ?? 0)} of {ticketBalance.allowance} class tickets
              remaining
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${
                    ticketBalance.allowance > 0
                      ? Math.min(100, (Math.max(0, ticketBalance.balance ?? 0) / ticketBalance.allowance) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Resets {currentPeriodEndFormatted}
            </p>

            {ledgerEntries.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ledger History
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Delta</th>
                        <th className="px-3 py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatMountainTime(entry.createdAt, "date")}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={LEDGER_TYPE_VARIANT[entry.type] ?? "outline"}>
                              {entry.type}
                            </Badge>
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-medium ${
                              entry.delta > 0 ? "text-green-700" : entry.delta < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {entry.delta > 0 ? "+" : ""}
                            {entry.delta}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {(entry.bookingId && sessionNameByBookingId.get(entry.bookingId)) ??
                              entry.note ??
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {membership.membershipEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Activity
          </h2>
          <ul className="space-y-2">
            {membership.membershipEvents.map((ev) => (
              <li key={ev.id} className="flex gap-3 text-sm">
                <span className="text-muted-foreground">
                  {formatMountainTime(ev.createdAt, "date")}
                </span>
                <span className="font-medium">{ev.eventType}</span>
                {ev.note && (
                  <span className="text-muted-foreground">{ev.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MembershipActions
        status={membership.status}
        currentPeriodEndFormatted={currentPeriodEndFormatted}
        inCommitment={inCommitment}
        commitmentEndsAtFormatted={commitmentEndsAtFormatted}
      />

      {membership.status === "ACTIVE" && (
        <PlanSwitcher
          otherPlans={otherPlans.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
          }))}
        />
      )}
    </main>
  );
}
