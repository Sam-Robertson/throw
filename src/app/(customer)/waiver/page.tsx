import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WaiverSignForm } from "./_components/WaiverSignForm";

export const dynamic = "force-dynamic";

export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const callback = callbackUrl ?? "/schedule";

  const session = await auth();
  if (!session?.user?.id) {
    const self = `/waiver${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(self)}`);
  }

  const userId = session.user.id;

  const activeVersion = await prisma.waiverVersion.findFirst({
    where: { isActive: true },
  });

  if (!activeVersion) redirect(callback);

  const existing = await prisma.waiverSignature.findUnique({
    where: {
      userId_waiverVersionId: { userId, waiverVersionId: activeVersion.id },
    },
    select: { id: true },
  });

  if (existing) redirect(callback);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Before you book</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Please read and sign our waiver to continue.
      </p>
      <WaiverSignForm
        waiverVersionId={activeVersion.id}
        content={activeVersion.content}
        userName={session.user.name ?? ""}
        callbackUrl={callback}
      />
    </main>
  );
}
