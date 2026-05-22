import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscribeButton } from "./_components/SubscribeButton";

export const dynamic = "force-dynamic";

function formatPrice(priceInCents: number, billingIntervalDays: number): string {
  const dollars = (priceInCents / 100).toFixed(2);
  if (billingIntervalDays <= 35) return `$${dollars}/mo`;
  if (billingIntervalDays <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/membership`);
  }

  const { planId } = await params;

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) redirect("/membership");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Start Membership</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{plan.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
          <p className="text-2xl font-bold">
            {formatPrice(plan.price, plan.billingIntervalDays)}
          </p>
          <p className="text-xs text-muted-foreground">
            Billed every {plan.billingIntervalDays} days
          </p>
        </CardContent>
      </Card>
      <SubscribeButton planId={planId} />
    </main>
  );
}
