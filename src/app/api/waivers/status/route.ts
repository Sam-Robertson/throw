import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getApplicableWaiver,
  hasSignedWaiver,
  resolveWaiverForVersion,
} from "@/lib/waivers";

// GET /api/waivers/status[?locationId=…|?versionId=…]
// Waivers are per location. With no parameter this reports on the most
// recently published active waiver (the fallback used for sessions without a
// location), which matches the previous single-waiver behavior.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");
  const locationId = searchParams.get("locationId");

  const waiver = versionId
    ? await resolveWaiverForVersion(versionId)
    : await getApplicableWaiver(locationId);

  if (!waiver) {
    return NextResponse.json({
      hasSigned: true,
      waiverVersionId: null,
      activeVersionId: null,
      locationId: null,
    });
  }

  const hasSigned = await hasSignedWaiver(userId, waiver.id);

  return NextResponse.json({
    hasSigned,
    // Kept for compatibility: historically this carried the signature's id
    // when signed. It now carries the version id either way.
    waiverVersionId: hasSigned ? waiver.id : null,
    activeVersionId: waiver.id,
    locationId: waiver.locationId,
  });
}
