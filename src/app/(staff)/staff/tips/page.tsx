import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { checkPermission } from "@/lib/permissions";
import { StaffTipsClient } from "./_components/StaffTipsClient";

export default async function StaffTipsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allowed = await checkPermission(session.user.id, "canViewTips");
  if (!allowed) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view tips. Ask an admin if you think this is a
          mistake.
        </p>
      </main>
    );
  }

  return <StaffTipsClient />;
}
