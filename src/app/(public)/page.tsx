import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function getUpcomingSessions() {
  return prisma.studioSession.findMany({
    where: { startsAt: { gte: new Date() }, isCancelled: false },
    include: {
      sessionType: { select: { name: true } },
      _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
    },
    orderBy: { startsAt: "asc" },
    take: 6,
  });
}

async function getActivePlans() {
  return prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
}

function formatPrice(cents: number, days: number) {
  const dollars = (cents / 100).toFixed(2);
  if (days <= 35) return `$${dollars}/mo`;
  if (days <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default async function HomePage() {
  const [sessions, plans] = await Promise.all([
    getUpcomingSessions(),
    getActivePlans(),
  ]);

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-foreground px-4 py-24 text-background">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Make something with your hands.
          </h1>
          <p className="mt-6 text-lg text-background/70 sm:text-xl">
            Pottery studio in Provo, Utah. Open studio sessions, classes, and
            memberships.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/schedule">Browse Schedule</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-background/30 bg-transparent text-background hover:bg-background/10"
              asChild
            >
              <Link href="/membership">View Memberships</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── This Week ──────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-2xl font-bold">This Week</h2>

          {sessions.length === 0 ? (
            <p className="text-muted-foreground">
              No upcoming sessions this week. Check back soon!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((s) => {
                const spots = s.capacity - s._count.bookings;
                const isFull = spots <= 0;
                return (
                  <Card key={s.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">
                          {s.sessionType.name}
                        </CardTitle>
                        {isFull && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Full
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {formatMountainTime(s.startsAt, "datetime")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-2">
                      <p className="text-sm text-muted-foreground">
                        {isFull ? (
                          <span className="text-destructive">No spots left</span>
                        ) : (
                          `${spots} spot${spots !== 1 ? "s" : ""} remaining`
                        )}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        asChild
                        size="sm"
                        variant={isFull ? "secondary" : "default"}
                        className="w-full"
                      >
                        <Link href={`/schedule/${s.id}`}>
                          {isFull ? "Join Waitlist" : "Book"}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/schedule"
              className="text-sm underline underline-offset-4 hover:text-muted-foreground"
            >
              See full schedule →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Become a Member ────────────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-2xl font-bold">Become a Member</h2>
          <p className="mb-8 text-muted-foreground">
            Unlimited access, priority booking, and more.
          </p>

          {plans.length === 0 ? (
            <p className="text-muted-foreground">
              Membership plans coming soon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    {p.description && (
                      <CardDescription>{p.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatPrice(p.price, p.billingIntervalDays)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/membership">Learn More</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Visit Us ───────────────────────────────────────────── */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-2xl font-bold">Visit Us</h2>
          <div className="grid gap-8 md:grid-cols-2">
            {/* Text */}
            <div>
              <div className="mb-6">
                <h3 className="mb-1 font-semibold">Address</h3>
                <p className="text-muted-foreground">Provo, Utah</p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Hours</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((day) => (
                    <li key={day} className="flex justify-between gap-4">
                      <span>{day}</span>
                      <span>See schedule for session times</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-4">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Photo placeholder */}
            <div className="flex min-h-48 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              Photo coming soon
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
