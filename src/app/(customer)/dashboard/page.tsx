import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatMountainTime } from "@/lib/timezone";
import { SignOutButton } from "./_components/SignOutButton";
import { CancelBookingButton } from "./_components/CancelBookingButton";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CONFIRMED: "default",
  WAITLIST: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "secondary",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [membership, activeWaiver, upcomingCount, upcomingBookings] =
    await Promise.all([
      prisma.membership.findFirst({
        where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
        include: { plan: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.waiverVersion.findFirst({
        where: { isActive: true },
        include: { signatures: { where: { userId } } },
        orderBy: { publishedAt: "desc" },
      }),
      prisma.booking.count({
        where: {
          userId,
          status: { in: ["CONFIRMED", "WAITLIST"] },
          studioSession: { startsAt: { gte: now } },
        },
      }),
      prisma.booking.findMany({
        where: {
          userId,
          status: { in: ["CONFIRMED", "WAITLIST"] },
          studioSession: { startsAt: { gte: now } },
        },
        include: {
          studioSession: {
            include: {
              sessionType: { select: { name: true } },
              location: { select: { name: true } },
            },
          },
        },
        orderBy: { studioSession: { startsAt: "asc" } },
        take: 5,
      }),
    ]);

  const waiverSigned = !activeWaiver || activeWaiver.signatures.length > 0;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-8 flex items-start justify-between">
        <h1 className="text-2xl font-semibold">
          Welcome, {session.user.name ?? session.user.email}
        </h1>
        <SignOutButton />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Membership
          </p>
          {membership ? (
            <>
              <p className="mt-1 font-semibold">{membership.plan.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {membership.status === "PAUSED"
                  ? "Paused"
                  : `Renews ${formatMountainTime(membership.currentPeriodEnd, "date")}`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                No active membership
              </p>
              <Link
                href="/membership"
                className="mt-1 block text-sm underline underline-offset-4"
              >
                Browse Plans
              </Link>
            </>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming Bookings
          </p>
          <p className="mt-1 text-2xl font-semibold">{upcomingCount}</p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Waiver
          </p>
          {waiverSigned ? (
            <p className="mt-1 text-sm font-medium text-green-600">Signed</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Signature required
              </p>
              <Link
                href="/waiver"
                className="mt-1 block text-sm underline underline-offset-4"
              >
                Sign now
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Upcoming bookings list */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Upcoming Sessions</h2>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {upcomingBookings.map((b) => {
              const canCancel = b.studioSession.startsAt > twoHoursFromNow;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {b.studioSession.sessionType.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMountainTime(b.studioSession.startsAt, "datetime")}
                      {b.studioSession.location &&
                        ` · ${b.studioSession.location.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={STATUS_VARIANT[b.status] ?? "outline"}
                      className="text-xs"
                    >
                      {b.status}
                    </Badge>
                    {canCancel && <CancelBookingButton bookingId={b.id} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/schedule"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Browse Schedule
          </Link>
          <Link
            href="/bookings"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            My Bookings
          </Link>
          <Link
            href="/membership/manage"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Manage Membership
          </Link>
          <Link
            href="/account"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Account Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
