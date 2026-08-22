import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { getTicketBalance } from "@/lib/credits";
import { BookingForm } from "./_components/BookingForm";

async function getSession(id: string) {
  return prisma.studioSession.findUnique({
    where: { id },
    include: {
      sessionType: {
        select: {
          name: true,
          durationMinutes: true,
          dropInPriceCents: true,
        },
      },
      instructor: { select: { name: true } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
  });
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect(`/login?callbackUrl=/book/${id}`);
  }

  const userId = authSession.user.id;
  const studioSession = await getSession(id);
  if (!studioSession) notFound();

  if (studioSession.isCancelled) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6">
          <Link
            href="/schedule"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to schedule
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Session cancelled</h1>
          <p className="mt-2 text-muted-foreground">
            This session has been cancelled and is no longer available for
            booking.
          </p>
        </div>
      </main>
    );
  }

  // Waiver check
  if (studioSession.locationId) {
    const activeWaiver = await prisma.waiverVersion.findFirst({
      where: { locationId: studioSession.locationId, isActive: true },
      select: { id: true },
    });
    if (activeWaiver) {
      const signed = await prisma.waiverSignature.findUnique({
        where: {
          userId_waiverVersionId: {
            userId,
            waiverVersionId: activeWaiver.id,
          },
        },
      });
      if (!signed) {
        redirect(`/waiver?callbackUrl=/book/${id}`);
      }
    }
  }

  // Duplicate booking check — show already-booked state
  const existingBooking = await prisma.booking.findFirst({
    where: { userId, studioSessionId: id, status: { not: "CANCELLED" } },
    select: { status: true },
  });

  if (existingBooking) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6">
          <Link
            href="/schedule"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to schedule
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold">
            {existingBooking.status === "CONFIRMED"
              ? "You're already booked"
              : "You're on the waitlist"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {existingBooking.status === "CONFIRMED"
              ? "You have a confirmed booking for this session."
              : "You are on the waitlist for this session."}
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm underline underline-offset-4"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const activeMembership = await prisma.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
    },
    select: { id: true },
  });

  const ticketBalance = activeMembership ? await getTicketBalance(activeMembership.id) : null;

  const spotsRemaining =
    studioSession.capacity - studioSession._count.bookings;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Link
          href={`/schedule/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to session details
        </Link>
      </div>

      <BookingForm
        sessionId={id}
        hasMembership={activeMembership !== null}
        membershipUnlimited={ticketBalance?.unlimited ?? false}
        ticketsRemaining={
          ticketBalance && !ticketBalance.unlimited ? Math.max(0, ticketBalance.balance ?? 0) : null
        }
        ticketAllowance={ticketBalance && !ticketBalance.unlimited ? ticketBalance.allowance : null}
        ticketsResetDate={
          ticketBalance ? formatMountainTime(ticketBalance.periodEnd, "date") : null
        }
        dropInPriceCents={studioSession.sessionType.dropInPriceCents}
        sessionName={studioSession.sessionType.name}
        sessionDate={formatMountainTime(studioSession.startsAt, "date")}
        sessionTime={formatMountainTime(studioSession.startsAt, "time")}
        instructorName={studioSession.instructor?.name ?? null}
        durationMinutes={studioSession.sessionType.durationMinutes}
        spotsRemaining={spotsRemaining}
      />
    </main>
  );
}
