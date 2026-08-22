import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { checkPermission } from "@/lib/permissions";
import { DrawerClient } from "./_components/DrawerClient";

export default async function PosDrawerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to manage the cash drawer. Ask an admin if you think
          this is a mistake.
        </p>
      </main>
    );
  }

  return <DrawerClient />;
}
