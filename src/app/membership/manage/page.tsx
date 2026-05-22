import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatMountainTime } from "@/lib/timezone";
import { MembershipActions } from "./_components/MembershipActions";
import { PlanSwitcher } from "./_components/PlanSwitcher";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "outline",
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
