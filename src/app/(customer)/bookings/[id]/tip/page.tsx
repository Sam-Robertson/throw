import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { TipForm } from "./_components/TipForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TipPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true } },
          instructor: { select: { id: true, name: true } },
        },
      },
    },
  });

  // 404 if booking doesn't exist or doesn't belong to this user
  if (!booking || booking.userId !== session.user.id) {
    notFound();
  }

  const { studioSession } = booking;
  const now = new Date();

  // Session must have ended
  if (studioSession.endsAt >= now) {
    notFound();
  }

  const instructor = studioSession.instructor;

  // No instructor — show a friendly message
  if (!instructor) {
    return (
      <main className="mx-auto max-w-md p-8">
        <Link
          href="/bookings"
          className="mb-6 block text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Back to bookings
        </Link>
        <p className="text-sm text-muted-foreground">
          No instructor was assigned to this session. Tips are only available when
          an instructor is on file.
        </p>
      </main>
    );
  }

  // Check if tip already left
  const existingTip = await prisma.tip.findFirst({
    where: { bookingId },
  });

  if (existingTip) {
    return (
      <main className="mx-auto max-w-md p-8">
        <Link
          href="/bookings"
          className="mb-6 block text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Back to bookings
        </Link>
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-2xl">💚</p>
          <p className="mt-2 font-semibold">You already left a tip for this class</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you for supporting {instructor.name}!
          </p>
          <Link
            href="/bookings"
            className="mt-4 block text-sm underline underline-offset-4"
          >
            Back to bookings
          </Link>
        </div>
      </main>
    );
  }

  const sessionDate = formatMountainTime(studioSession.startsAt, "datetime");

  return (
    <main className="mx-auto max-w-md p-8">
      <Link
        href="/bookings"
        className="mb-6 block text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Back to bookings
      </Link>
      <TipForm
        bookingId={bookingId}
        instructorName={instructor.name ?? "your instructor"}
        sessionName={studioSession.sessionType.name}
        sessionDate={sessionDate}
      />
    </main>
  );
}
