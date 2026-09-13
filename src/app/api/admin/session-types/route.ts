import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, locationWhere, resolveLocationScope } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const upcomingCount = {
  _count: {
    select: {
      studioSessions: {
        where: { startsAt: { gt: new Date() }, isCancelled: false },
      },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  // Strict match on locationId, as before: class types with no studio only
  // appear in the unrestricted (ADMIN, all-locations) view.
  const sessionTypes = await prisma.sessionType.findMany({
    where: locationWhere(guard.scope),
    orderBy: { name: "asc" },
    include: { ...upcomingCount, location: { select: { id: true, name: true } } },
  });

  return NextResponse.json(sessionTypes);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { name, description, durationMinutes, capacity, dropInPriceCents, isBusyWindow, isTemplate, locationId } =
    body as Record<string, unknown>;

  if (!name || !durationMinutes || !capacity || dropInPriceCents === undefined || !locationId)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  // STAFF may only create class types for a studio they're assigned to.
  try {
    resolveLocationScope(guard.session, String(locationId));
  } catch (err) {
    return forbiddenResponse(err);
  }

  const slug = slugify(String(name));
  const slugExists = await prisma.sessionType.findUnique({ where: { slug } });
  if (slugExists)
    return NextResponse.json(
      { error: "A class type with this name already exists" },
      { status: 409 },
    );

  const sessionType = await prisma.sessionType.create({
    data: {
      name: String(name),
      slug,
      description: description ? String(description) : null,
      durationMinutes: Number(durationMinutes),
      capacity: Number(capacity),
      dropInPriceCents: Number(dropInPriceCents),
      isBusyWindow: Boolean(isBusyWindow),
      // Creating a class type by hand through the admin UI IS the act of
      // defining a reusable template — see the schema comment on isTemplate.
      isTemplate: isTemplate === undefined ? true : Boolean(isTemplate),
      locationId: String(locationId),
    },
    include: { ...upcomingCount, location: { select: { id: true, name: true } } },
  });

  return NextResponse.json(sessionType, { status: 201 });
}
