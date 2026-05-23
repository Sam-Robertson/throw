import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MembershipSuccessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!membership) redirect("/membership");

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-4 text-5xl">🎉</div>
      <h1 className="mb-2 text-3xl font-bold">Welcome!</h1>
      <p className="mb-6 text-muted-foreground">
        Your membership is now active.
      </p>
      <div className="mb-8 rounded-lg border p-6 text-left">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{membership.plan.name}</span>
          <Badge>Active</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Next billing date:{" "}
          <span className="font-medium text-foreground">
            {new Date(membership.currentPeriodEnd).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </main>
  );
}
