import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, locationWhereOrUnassigned, resolveLocationScope } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { parseCatalogFields, parseLocationPrices, sessionTypeInclude, slugify } from "./fields";

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  // Catalog class types belong to no studio (they are priced per studio
  // instead), so they are visible from every studio's view. Archived types
  // are included: the client decides which list to show.
  const sessionTypes = await prisma.sessionType.findMany({
    where: locationWhereOrUnassigned(guard.scope),
    orderBy: { name: "asc" },
    include: sessionTypeInclude(),
  });

  return NextResponse.json(sessionTypes);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { name, description, durationMinutes, capacity, dropInPriceCents, isBusyWindow, isTemplate, locationId } = body;

  if (!name || !durationMinutes || !capacity || dropInPriceCents === undefined)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  if (!Number.isInteger(Number(dropInPriceCents)) || Number(dropInPriceCents) < 0)
    return NextResponse.json({ error: "dropInPriceCents must be a whole number of cents" }, { status: 400 });

  // A class type tied to one studio may only be created by staff assigned to
  // it. No locationId means it runs at every studio.
  if (locationId) {
    try {
      resolveLocationScope(guard.session, String(locationId));
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  const catalog = parseCatalogFields(body);
  if (!catalog.ok) return NextResponse.json({ error: catalog.error }, { status: 400 });
  const prices = parseLocationPrices(body.locationPrices ?? []);
  if (!prices.ok) return NextResponse.json({ error: prices.error }, { status: 400 });

  const slug = slugify(String(name));
  const slugExists = await prisma.sessionType.findUnique({ where: { slug } });
  if (slugExists)
    return NextResponse.json(
      {
        error: slugExists.archivedAt
          ? "An archived class type already has this name — restore it instead"
          : "A class type with this name already exists",
      },
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
      locationId: locationId ? String(locationId) : null,
      ...catalog.value,
      locationPrices: { create: prices.value },
    },
    include: sessionTypeInclude(),
  });

  return NextResponse.json(sessionType, { status: 201 });
}
