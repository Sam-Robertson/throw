import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireStaff() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null as null };
}

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const shelves = await prisma.shelfSpace.findMany({
    where: { locationId },
    include: {
      membership: {
        select: {
          id: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  return NextResponse.json(shelves);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    number?: number;
    shelfType?: string;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (!body.number || body.number <= 0) {
    return NextResponse.json({ error: "number is required and must be positive" }, { status: 400 });
  }
  if (body.shelfType !== "FULL" && body.shelfType !== "HALF") {
    return NextResponse.json({ error: "shelfType must be FULL or HALF" }, { status: 400 });
  }

  const existing = await prisma.shelfSpace.findUnique({
    where: { locationId_number: { locationId: body.locationId, number: body.number } },
  });
  if (existing) {
    return NextResponse.json({ error: "A shelf with this number already exists" }, { status: 409 });
  }

  const shelf = await prisma.shelfSpace.create({
    data: { locationId: body.locationId, number: body.number, shelfType: body.shelfType },
  });

  return NextResponse.json(shelf, { status: 201 });
}
