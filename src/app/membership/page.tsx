import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function formatPrice(priceInCents: number, billingIntervalDays: number): string {
  const dollars = (priceInCents / 100).toFixed(2);
  if (billingIntervalDays <= 35) return `$${dollars}/mo`;
  if (billingIntervalDays <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default async function MembershipPage() {
  const session = await auth();

  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  let activeMembership: { id: string } | null = null;
  if (session?.user?.id) {
    activeMembership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { id: true },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-4xl font-bold">Membership Plans</h1>
        <p className="text-muted-foreground">
          Join our studio community with a recurring membership.
        </p>
      </div>

      {activeMembership && (
        <div className="mb-8 flex items-center justify-between rounded-lg border bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <Badge>Active Member</Badge>
            <span className="text-sm text-muted-foreground">
              You already have an active membership.
            </span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/membership/manage">Manage</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              {plan.description && (
                <CardDescription>{plan.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">
                {formatPrice(plan.price, plan.billingIntervalDays)}
              </p>
            </CardContent>
            <CardFooter>
              {activeMembership ? (
                <Button className="w-full" disabled>
                  You&apos;re a member
                </Button>
              ) : session?.user ? (
                <Button asChild className="w-full">
                  <Link href={`/membership/subscribe/${plan.id}`}>Join</Link>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href={`/login?callbackUrl=/membership`}>Join</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
        {plans.length === 0 && (
          <p className="col-span-full py-12 text-center text-muted-foreground">
            No membership plans are currently available.
          </p>
        )}
      </div>
    </main>
  );
}
