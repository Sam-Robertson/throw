import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  // The register is always bound to one physical studio, whatever the admin
  // sidebar's location switcher says. Admins can pick any active studio; staff
  // only the ones they're assigned to — the same rule checkPermission applies
  // to every POS route (/api/admin/locations lists every studio to any staff).
  const isAdmin = session.user.role === "ADMIN";
  const assignments = isAdmin
    ? []
    : await prisma.staffRoleAssignment.findMany({
        where: { userId: session.user.id },
        select: { locationId: true },
      });
  const locations = await prisma.location.findMany({
    where: {
      isActive: true,
      ...(isAdmin ? {} : { id: { in: assignments.map((a) => a.locationId) } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, isActive: true },
  });

  return (
    <PosTerminal
      staffId={session.user.id}
      staffName={session.user.name ?? session.user.email ?? "Staff"}
      isAdmin={isAdmin}
      locations={locations}
    />
  );
}
