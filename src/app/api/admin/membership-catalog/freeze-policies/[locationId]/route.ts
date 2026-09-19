import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffScope } from "@/lib/staffScope";
import {
  flag,
  has,
  inputErrorResponse,
  wholeNumberOrNull,
  type Body,
} from "../../_lib/input";

// Creates the studio's policy on first save. Send null to clear an amount
// back to "not decided yet".
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  // Passing the studio as the requested scope is the access check.
  const guard = await requireStaffScope(locationId);
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const data: {
    monthlyFeeCents?: number | null;
    creditCentsPerFrozenMonth?: number | null;
    forfeitsFoundingRate?: boolean;
  } = {};
  try {
    if (has(body, "monthlyFeeCents")) data.monthlyFeeCents = wholeNumberOrNull(body, "monthlyFeeCents");
    if (has(body, "creditCentsPerFrozenMonth"))
      data.creditCentsPerFrozenMonth = wholeNumberOrNull(body, "creditCentsPerFrozenMonth");
    if (has(body, "forfeitsFoundingRate")) data.forfeitsFoundingRate = flag(body, "forfeitsFoundingRate");
  } catch (err) {
    return inputErrorResponse(err);
  }

  const policy = await prisma.freezePolicy.upsert({
    where: { locationId },
    create: { locationId, ...data },
    update: data,
  });
  return NextResponse.json(policy);
}
