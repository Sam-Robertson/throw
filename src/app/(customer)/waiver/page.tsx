import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WaiverSignatureForm } from "@/components/shared/WaiverSignatureForm";
import {
  getApplicableWaiver,
  hasSignedWaiver,
  resolveWaiverForVersion,
  safeCallbackUrl,
} from "@/lib/waivers";

export const dynamic = "force-dynamic";

// /waiver?versionId=…&callbackUrl=… (or ?locationId=…). The booking page and
// booking APIs send the specific version the session's studio requires, since
// each studio has its own waiver.
export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; versionId?: string; locationId?: string }>;
}) {
  const { callbackUrl, versionId, locationId } = await searchParams;
  const callback = safeCallbackUrl(callbackUrl);

  const session = await auth();
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    if (versionId) params.set("versionId", versionId);
    if (locationId) params.set("locationId", locationId);
    if (callbackUrl) params.set("callbackUrl", callback);
    const query = params.toString();
    const self = `/waiver${query ? `?${query}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(self)}`);
  }

  const userId = session.user.id;

  const waiver = versionId
    ? await resolveWaiverForVersion(versionId)
    : await getApplicableWaiver(locationId ?? null);

  if (!waiver) redirect(callback);

  if (await hasSignedWaiver(userId, waiver.id)) redirect(callback);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold">Before you book</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Please read and sign the {waiver.locationName} waiver to continue.
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
