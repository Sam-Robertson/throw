import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

async function getSessionTypes() {
  return prisma.sessionType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

async function getSessions(typeSlug?: string) {
  return prisma.studioSession.findMany({
    where: {
      startsAt: { gte: new Date() },
      isCancelled: false,
      ...(typeSlug
        ? { sessionType: { slug: typeSlug } }
        : {}),
    },
    include: {
      sessionType: {
        select: {
          name: true,
          slug: true,
          durationMinutes: true,
          dropInPriceCents: true,
        },
      },
      instructor: { select: { name: true } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
    orderBy: { startsAt: "asc" },
  });
}

type Session = Awaited<ReturnType<typeof getSessions>>[number];

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = formatMountainTime(s.startsAt, "date");
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return groups;
}

function SessionCard({ session }: { session: Session }) {
  const spotsRemaining = session.capacity - session._count.bookings;
  const isFull = spotsRemaining <= 0;

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{session.sessionType.name}</h3>
        {isFull && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            Full
          </Badge>
        )}
      </div>

      <dl className="mb-4 space-y-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Time</dt>
          <dd>{formatMountainTime(session.startsAt, "time")}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Duration</dt>
          <dd>{session.sessionType.durationMinutes} min</dd>
        </div>
        {session.instructor?.name && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Instructor</dt>
            <dd>{session.instructor.name}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Spots left</dt>
          <dd className={isFull ? "text-destructive" : undefined}>
            {isFull ? "0" : spotsRemaining}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Drop-in</dt>
          <dd>{formatPrice(session.sessionType.dropInPriceCents)}</dd>
        </div>
      </dl>

      <Button
        asChild
        size="sm"
        variant={isFull ? "secondary" : "default"}
        className="w-full"
      >
        <Link href={`/schedule/${session.id}`}>
          {isFull ? "Join Waitlist" : "Book"}
        </Link>
      </Button>
    </div>
  );
}

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function SchedulePage({ searchParams }: Props) {
  const { type: typeSlug } = await searchParams;

  const [sessionTypes, sessions] = await Promise.all([
    getSessionTypes(),
    getSessions(typeSlug),
  ]);

  const grouped = groupByDate(sessions);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Schedule</h1>

      {/* Filter bar */}
      {sessionTypes.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/schedule"
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              !typeSlug
                ? "border-foreground bg-foreground text-background"
                : "hover:border-foreground hover:bg-accent",
            )}
          >
            All
          </Link>
          {sessionTypes.map((t) => (
            <Link
              key={t.id}
              href={`/schedule?type=${t.slug}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                typeSlug === t.slug
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground hover:bg-accent",
              )}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {grouped.size === 0 ? (
        <p className="text-muted-foreground">
          No upcoming sessions scheduled. Check back soon.
        </p>
      ) : (
        <div className="space-y-10">
          {Array.from(grouped.entries()).map(([date, daySessions]) => (
            <section key={date}>
              <h2 className="mb-4 text-lg font-semibold">{date}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {daySessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
