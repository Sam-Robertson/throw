import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  resolveLocationScope,
  scopeAllows,
  scopeAllowsUnassigned,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { parseCatalogFields, parseLocationPrices, sessionTypeInclude } from "../fields";

const NOT_VISIBLE = { error: "This class type belongs to a studio you don't have access to" };

// Archived class types are hidden from the schedule pickers, the public
// schedule and the POS, but their sessions, bookings and orders keep pointing
// at them. Class types are never deleted.
const ARCHIVE = { isActive: false, isTemplate: false } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const sessionType = await prisma.sessionType.findUnique({
    where: { id },
    include: sessionTypeInclude(),
  });

  if (!sessionType)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, sessionType.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  return NextResponse.json(sessionType);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.sessionType.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  const { name, description, durationMinutes, capacity, dropInPriceCents, isBusyWindow, isActive, isTemplate, locationId, archived } =
    body;

  // Moving a class type to another studio requires access to that studio.
  // null makes it a class type that runs at every studio.
  if (locationId !== undefined && locationId !== null) {
    try {
      resolveLocationScope(guard.session, String(locationId));
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  if (
    dropInPriceCents !== undefined &&
    (!Number.isInteger(Number(dropInPriceCents)) || Number(dropInPriceCents) < 0)
  )
    return NextResponse.json({ error: "dropInPriceCents must be a whole number of cents" }, { status: 400 });

  const catalog = parseCatalogFields(body);
  if (!catalog.ok) return NextResponse.json({ error: catalog.error }, { status: 400 });

  let prices = null;
  if (body.locationPrices !== undefined) {
    const parsed = parseLocationPrices(body.locationPrices);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.value.some((p) => !scopeAllows(guard.scope, p.locationId)))
      return NextResponse.json({ error: "You can't set a price for a studio you don't have access to" }, { status: 403 });
    prices = parsed.value;
  }

  // The slug is deliberately left alone on rename: scripts/sync-class-types.ts
  // and the public schedule's ?type= filter match class types on it.
  const updated = await prisma.$transaction(async (tx) => {
    if (prices) {
      // The list is the full set of studio prices, within the studios this
      // caller can see: studios left out fall back to the default price.
      const keep = prices.map((p) => p.locationId);
      await tx.sessionTypeLocationPrice.deleteMany({
        where: {
          sessionTypeId: id,
          locationId: {
            notIn: keep,
            ...(guard.scope.locationIds !== null && { in: guard.scope.locationIds }),
          },
        },
      });
      for (const p of prices) {
        await tx.sessionTypeLocationPrice.upsert({
          where: { sessionTypeId_locationId: { sessionTypeId: id, locationId: p.locationId } },
          create: { sessionTypeId: id, ...p },
          update: { priceCents: p.priceCents, memberPriceCents: p.memberPriceCents, isConfirmed: p.isConfirmed },
        });
      }
    }

    return tx.sessionType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(description !== undefined && {
          description: description ? String(description) : null,
        }),
        ...(durationMinutes !== undefined && {
          durationMinutes: Number(durationMinutes),
        }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(dropInPriceCents !== undefined && {
          dropInPriceCents: Number(dropInPriceCents),
        }),
        ...(isBusyWindow !== undefined && { isBusyWindow: Boolean(isBusyWindow) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(isTemplate !== undefined && { isTemplate: Boolean(isTemplate) }),
        ...(locationId !== undefined && { locationId: locationId ? String(locationId) : null }),
        ...catalog.value,
        // Archive / restore win over isActive and isTemplate in the same body.
        ...(archived === true && { ...ARCHIVE, archivedAt: existing.archivedAt ?? new Date() }),
        ...(archived === false && { archivedAt: null, isActive: true }),
      },
      include: sessionTypeInclude(),
    });
  });

  return NextResponse.json(updated);
}

/**
 * Archives the class type. It used to hard-delete; a class type that has ever
 * been scheduled carries booking and order history, so it is kept and hidden
 * instead. Restore it with PATCH { archived: false }.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;

  const existing = await prisma.sessionType.findUnique({
    where: { id },
    select: { locationId: true, archivedAt: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  const archived = await prisma.sessionType.update({
    where: { id },
    data: { ...ARCHIVE, archivedAt: existing.archivedAt ?? new Date() },
    include: sessionTypeInclude(),
  });
  return NextResponse.json(archived);
}
