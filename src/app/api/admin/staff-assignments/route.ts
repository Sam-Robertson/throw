import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const assignments = await prisma.staffRoleAssignment.findMany({
    where: locationId ? { locationId } : {},
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      staffRole: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      locationId: a.locationId,
      userName: a.user.name,
      userEmail: a.user.email,
      userRole: a.user.role,
      staffRoleId: a.staffRoleId,
      staffRoleName: a.staffRole.name,
    })),
  );
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    staffRoleId?: string;
    locationId?: string;
  } | null;

  if (!body?.userId || !body.staffRoleId || !body.locationId) {
    return NextResponse.json(
      { error: "userId, staffRoleId, and locationId are required" },
      { status: 400 },
    );
  }

  const assignment = await prisma.staffRoleAssignment.upsert({
    where: {
      userId_locationId: { userId: body.userId, locationId: body.locationId },
    },
    update: { staffRoleId: body.staffRoleId },
    create: {
      userId: body.userId,
      staffRoleId: body.staffRoleId,
      locationId: body.locationId,
    },
    include: { staffRole: { select: { id: true, name: true } } },
  });

  return NextResponse.json(assignment);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    locationId?: string;
  } | null;

  if (!body?.userId || !body.locationId) {
    return NextResponse.json({ error: "userId and locationId are required" }, { status: 400 });
  }

  await prisma.staffRoleAssignment.deleteMany({
    where: { userId: body.userId, locationId: body.locationId },
  });

  return NextResponse.json({ success: true });
}
