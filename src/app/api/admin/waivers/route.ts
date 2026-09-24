import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText, isRichTextEmpty } from "@/lib/richText";
import { isWaiverKind } from "@/lib/waiverKinds";
import { WAIVER_ADMIN_SELECT } from "./_shared";

/** Every waiver with all its versions, current first. Archived ones included (flagged). */
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const waivers = await prisma.waiver.findMany({
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { kind: "asc" }, { name: "asc" }],
    select: WAIVER_ADMIN_SELECT,
  });

  return NextResponse.json(waivers);
}

/**
 * Creates a waiver and publishes its first version.
 * Body: `{ name, kind, locationId | null, description?, content }`.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    kind?: unknown;
    locationId?: unknown;
    description?: unknown;
    content?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!isWaiverKind(body.kind))
    return NextResponse.json({ error: "kind must be CLASS, MEMBERSHIP or OTHER" }, { status: 400 });
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 500)
      : null;

  // Cleaned here, not just in the editor — this route accepts arbitrary JSON.
  const content = typeof body.content === "string" ? sanitizeRichText(body.content) : "";
  if (!content || isRichTextEmpty(content))
    return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const locationId = typeof body.locationId === "string" && body.locationId ? body.locationId : null;
  if (locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!location) return NextResponse.json({ error: "Unknown location" }, { status: 400 });
  }

  const waiver = await prisma.waiver.create({
    data: {
      name,
      kind: body.kind,
      locationId,
      description,
      versions: {
        create: { locationId, content, version: 1, publishedAt: new Date(), isActive: true },
      },
    },
    select: WAIVER_ADMIN_SELECT,
  });

  return NextResponse.json(waiver, { status: 201 });
}
