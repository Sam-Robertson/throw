import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type GuardResult = { error: NextResponse } | { error: null };

async function requireStaff(): Promise<GuardResult> {
  const session = await auth();
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  return { error: null };
}

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
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const locationId = req.nextUrl.searchParams.get("locationId");

  const sessionTypes = await prisma.sessionType.findMany({
    where: locationId ? { locationId } : undefined,
    orderBy: { name: "asc" },
    include: { ...upcomingCount, location: { select: { id: true, name: true } } },
  });

  return NextResponse.json(sessionTypes);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaff();
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
