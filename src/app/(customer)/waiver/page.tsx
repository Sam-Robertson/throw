import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WaiverSignatureForm } from "@/components/shared/WaiverSignatureForm";
import {
  getApplicableWaiver,
  hasSignedWaiver,
  resolveWaiverById,
  resolveWaiverForVersion,
  safeCallbackUrl,
} from "@/lib/waivers";

export const dynamic = "force-dynamic";

// /waiver?versionId=…&callbackUrl=…   a specific version (booking flows)
// /waiver?waiverId=…&callbackUrl=…    whatever version of one waiver is
//                                     current (printed QR codes, sign links)
// /waiver?locationId=…                that studio's class waiver
export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; versionId?: string; waiverId?: string; locationId?: string }>;
}) {
  const { callbackUrl, versionId, waiverId, locationId } = await searchParams;
  const callback = safeCallbackUrl(callbackUrl);

  const session = await auth();
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    if (versionId) params.set("versionId", versionId);
    if (waiverId) params.set("waiverId", waiverId);
    if (locationId) params.set("locationId", locationId);
    if (callbackUrl) params.set("callbackUrl", callback);
    const query = params.toString();
    const self = `/waiver${query ? `?${query}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(self)}`);
  }

  const userId = session.user.id;

  const waiver = versionId
    ? await resolveWaiverForVersion(versionId)
    : waiverId
      ? await resolveWaiverById(waiverId)
      : await getApplicableWaiver(locationId ?? null);

  if (!waiver) redirect(callback);

  if (await hasSignedWaiver(userId, waiver.id)) redirect(callback);

  const heading =
    waiver.kind === "MEMBERSHIP"
      ? "Before you start your membership"
      : waiver.kind === "CLASS"
        ? "Before you book"
        : "Please sign";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">{heading}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Please read and sign the {waiver.name}
        {waiver.locationName ? ` (${waiver.locationName})` : ""} to continue.
      </p>
      <WaiverSignatureForm
        waiverVersionId={waiver.id}
        content={waiver.content}
        userName={session.user.name ?? ""}
        callbackUrl={callback}
      />
    </main>
  );
}
