import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/qr";
import { WAIVER_KIND_LABELS, isWaiverKind } from "@/lib/waiverKinds";
import { waiverLinkForWaiver } from "@/lib/waivers";
import { PrintSheet, QrPoster } from "@/components/shared/QrPoster";

export const dynamic = "force-dynamic";

/** A printable QR poster that opens the current version of one waiver. */
export default async function WaiverQrPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") redirect("/admin");

  const { id } = await params;
  const waiver = await prisma.waiver.findUnique({
    where: { id },
    select: { id: true, name: true, kind: true, location: { select: { name: true } } },
  });
  if (!waiver) notFound();

  const url = `${appUrl()}${waiverLinkForWaiver(waiver.id)}`;
  const kind = isWaiverKind(waiver.kind) ? WAIVER_KIND_LABELS[waiver.kind] : "Waiver";

  return (
    <PrintSheet backHref="/admin/waivers" backLabel="Waivers">
      <QrPoster
        title={waiver.name}
        subtitle={`Scan to read and sign${waiver.location ? ` · ${waiver.location.name}` : ""}`}
        url={url}
        footnote={`${kind}. You'll be asked to sign in or create an account first so the signature is on file under your name.`}
      />
    </PrintSheet>
  );
}
