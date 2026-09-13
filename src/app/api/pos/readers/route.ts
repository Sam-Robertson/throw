import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { TerminalError, listReadersForLocation } from "@/lib/terminal";

/** Readers registered to a studio, for the POS reader picker. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const allowed = await checkPermission(session.user.id, "canUsePos", locationId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const readers = await listReadersForLocation(locationId);
    return NextResponse.json({ readers });
  } catch (err) {
    if (err instanceof TerminalError) {
      return NextResponse.json({ error: err.message, readers: [] }, { status: err.status });
    }
    throw err;
  }
}
