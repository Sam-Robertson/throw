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

  const entries = await prisma.shelfWaitlistEntry.findMany({
    where: { locationId, resolvedAt: null },
    include: {
      membership: {
        select: {
          id: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as {
    locationId?: string;
    membershipId?: string;
    requestedType?: string;
  } | null;

  if (!body?.locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  if (!body.membershipId) {
    return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
  }
  if (body.requestedType !== "FULL" && body.requestedType !== "HALF") {
    return NextResponse.json({ error: "requestedType must be FULL or HALF" }, { status: 400 });
  }

  const existing = await prisma.shelfWaitlistEntry.findFirst({
    where: { membershipId: body.membershipId, resolvedAt: null },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This member is already on the waitlist" },
      { status: 409 },
    );
  }

  const entry = await prisma.shelfWaitlistEntry.create({
    data: {
      locationId: body.locationId,
      membershipId: body.membershipId,
      requestedType: body.requestedType,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
