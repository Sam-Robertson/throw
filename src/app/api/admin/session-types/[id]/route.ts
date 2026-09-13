import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  resolveLocationScope,
  scopeAllowsUnassigned,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

const NOT_VISIBLE = { error: "This class type belongs to a studio you don't have access to" };

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const sessionType = await prisma.sessionType.findUnique({
    where: { id },
    include: { ...upcomingCount, location: { select: { id: true, name: true } } },
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
  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.sessionType.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  const { name, description, durationMinutes, capacity, dropInPriceCents, isBusyWindow, isActive, isTemplate, locationId } =
    body as Record<string, unknown>;

  // Moving a class type to another studio requires access to that studio.
  if (locationId !== undefined) {
    try {
      resolveLocationScope(guard.session, String(locationId));
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  const newSlug =
    name && String(name) !== existing.name ? slugify(String(name)) : undefined;

  if (newSlug) {
    const slugExists = await prisma.sessionType.findFirst({
      where: { slug: newSlug, id: { not: id } },
    });
    if (slugExists)
      return NextResponse.json(
        { error: "A class type with this name already exists" },
        { status: 409 },
      );
  }

  const updated = await prisma.sessionType.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name) }),
      ...(newSlug !== undefined && { slug: newSlug }),
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
      ...(locationId !== undefined && { locationId: String(locationId) }),
    },
    include: { ...upcomingCount, location: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;

  const existing = await prisma.sessionType.findUnique({
    where: { id },
    select: { locationId: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  const futureCount = await prisma.studioSession.count({
    where: { sessionTypeId: id, startsAt: { gt: new Date() }, isCancelled: false },
  });

  if (futureCount > 0)
    return NextResponse.json(
      {
        error: `Cannot delete: ${futureCount} upcoming session${futureCount === 1 ? "" : "s"} use this class type`,
      },
      { status: 409 },
    );

  await prisma.sessionType.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
