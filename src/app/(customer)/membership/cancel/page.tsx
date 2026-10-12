import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CancelReasonForm } from "./_components/CancelReasonForm";

export const dynamic = "force-dynamic";

/** "Why are you cancelling?" (design files): the first cancel step. */
export default async function CancelMembershipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/membership/cancel");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    select: { cancelAt: true },
  });
  if (!membership) redirect("/membership/pick");
  if (membership.cancelAt) redirect("/membership/manage");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">Why are you cancelling?</h1>
      <CancelReasonForm />
    </div>
  );
}
