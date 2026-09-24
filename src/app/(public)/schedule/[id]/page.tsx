import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CLASS_PRICE_SELECT, isSellable, resolveClassPriceCents } from "@/lib/sellable";
import { formatMountainTime } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/BackLink";

async function getSession(id: string) {
  return prisma.studioSession.findUnique({
    where: { id },
    include: {
      sessionType: {
        select: {
          ...CLASS_PRICE_SELECT,
          name: true,
          description: true,
          durationMinutes: true,
          priceUnit: true,
        },
      },
      instructor: { select: { name: true } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
  });
}

// Whole dollars print as "$200", anything else keeps its cents ("$29.99").
function formatPrice(cents: number, priceUnit: string) {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return priceUnit === "PER_WHEEL" ? `${amount} per wheel` : amount;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [rawSession, authSession] = await Promise.all([getSession(id), auth()]);

  if (!rawSession) notFound();
  const session = rawSession;
  const priceCents = resolveClassPriceCents({
    sessionType: session.sessionType,
    locationId: session.locationId,
    priceCentsOverride: session.priceCentsOverride,
  });

  const now = new Date();
  const isPast = session.endsAt < now;
  const spotsRemaining = session.capacity - session._count.bookings;
  const isFull = spotsRemaining <= 0;
  // The session's own length, unless it is implausible (Momence imported some
  // course rows spanning the whole course); then the class type's default.
  const sessionMinutes = Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000);
  const durationMinutes =
    sessionMinutes > 0 && sessionMinutes <= 12 * 60 ? sessionMinutes : session.sessionType.durationMinutes;

  let userBooking: { status: string } | null = null;
  if (authSession?.user?.id) {
    userBooking = await prisma.booking.findFirst({
      where: {
        userId: authSession.user.id,
        studioSessionId: id,
        status: { not: "CANCELLED" },
      },
      select: { status: true },
    });
  }

  // Same rule as the schedule list (PUBLICLY_LISTED_SESSION_TYPE): a private,
  // internal or archived class type has no public page. Someone already booked
  // on the session can still open it from their bookings.
  const { sessionType } = session;
  const isListed =
    sessionType.isActive && sessionType.archivedAt === null && sessionType.isPublic && !sessionType.isBusyWindow;
  if (!isListed && !userBooking) notFound();

  function cta() {
    if (session.isCancelled) {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (isPast) {
      return <Badge variant="secondary">This session has ended</Badge>;
    }
    if (userBooking?.status === "CONFIRMED") {
      return (
        <Badge className="bg-green-600 text-white">
          You&apos;re booked for this session
        </Badge>
      );
    }
    if (userBooking?.status === "WAITLIST") {
      return (
        <Badge variant="secondary">You&apos;re on the waitlist</Badge>
      );
    }
    // Not logged in
    if (!authSession?.user) {
      return (
        <Button asChild size="lg">
          <Link href={`/login?callbackUrl=/schedule/${session.id}`}>
            Sign in to book
          </Link>
        </Button>
      );
    }
    // Logged in, available
    return (
      <Button asChild size="lg">
        <Link href={`/book/${session.id}`}>
          {isFull ? "Join Waitlist" : "Book This Session"}
        </Link>
      </Button>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <BackLink href="/schedule">Schedule</BackLink>
      </div>

      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{session.title ?? session.sessionType.name}</h1>
          {isFull && !isPast && !session.isCancelled && (
            <Badge variant="secondary">Full</Badge>
          )}
        </div>

        {session.sessionType.description && (
          <p className="mb-6 text-muted-foreground">
            {session.sessionType.description}
          </p>
        )}

        <dl className="mb-8 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="font-medium">Date</dt>
            <dd className="text-muted-foreground">
              {formatMountainTime(session.startsAt, "date")}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Time</dt>
            <dd className="text-muted-foreground">
              {formatMountainTime(session.startsAt, "time")}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Duration</dt>
            <dd className="text-muted-foreground">
              {durationMinutes} min
            </dd>
          </div>
          {session.instructor?.name && (
            <div>
              <dt className="font-medium">Instructor</dt>
              <dd className="text-muted-foreground">{session.instructor.name}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">Spots remaining</dt>
            <dd className={isFull ? "text-destructive" : "text-muted-foreground"}>
              {isFull ? "Full" : spotsRemaining}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Price</dt>
            <dd className="text-muted-foreground">
              {isSellable(session.sessionType, priceCents)
                ? formatPrice(priceCents, session.sessionType.priceUnit)
                : "Members only"}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-3">{cta()}</div>
      </div>
    </div>
  );
}
