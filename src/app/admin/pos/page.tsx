import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { checkPermission } from "@/lib/permissions";
import { PosTerminal } from "./_components/PosTerminal";

export default async function PosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to use the point of sale. Ask an admin if you think
          this is a mistake.
        </p>
      </main>
    );
  }

  return (
    <PosTerminal
      staffId={session.user.id}
      staffName={session.user.name ?? session.user.email ?? "Staff"}
      isAdmin={session.user.role === "ADMIN"}
    />
  );
}
