import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/qr";
import { PrintSheet, QrPoster } from "@/components/shared/QrPoster";

export const dynamic = "force-dynamic";

/**
 * Printable "log your pieces" posters, one per studio. Each QR opens the
 * customer piece form for that studio, so pieces land in the right kiln queue
 * without the customer having to pick a studio or have a booking on file.
 */
export default async function PiecesQrPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") redirect("/admin");

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PrintSheet backHref="/admin/pieces" backLabel="Pieces">
      {locations.length === 0 && <p className="p-10 text-center text-muted-foreground">No active studios.</p>}
      {locations.map((loc) => (
        <QrPoster
          key={loc.id}
          title="Made something today?"
          subtitle={`Scan to log your pieces at ${loc.name} so we can track them through drying and firing, and text you when they're ready.`}
          url={`${appUrl()}/pieces/new?${new URLSearchParams({ location: loc.id })}`}
          footnote="Sign in or create a free account first, so your pieces are saved under your name."
        />
      ))}
    </PrintSheet>
  );
}
