import { NextResponse } from "next/server";
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;

  const shelf = await prisma.shelfSpace.findUnique({ where: { id } });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    membershipId?: string | null;
    notes?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: { membershipId?: string | null; notes?: string } = {};

  if (body.membershipId !== undefined) {
    if (body.membershipId === null) {
      data.membershipId = null;
    } else {
      const membership = await prisma.membership.findUnique({
        where: { id: body.membershipId },
        include: { plan: true, shelfSpace: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      }
      if (membership.plan.shelfType !== shelf.shelfType) {
        return NextResponse.json(
          { error: `This membership's plan does not include a ${shelf.shelfType} shelf` },
          { status: 400 },
        );
      }
      if (membership.shelfSpace && membership.shelfSpace.id !== shelf.id) {
        return NextResponse.json(
          { error: "This member is already assigned to a different shelf" },
          { status: 409 },
        );
      }
      if (shelf.membershipId && shelf.membershipId !== body.membershipId) {
        return NextResponse.json({ error: "This shelf is already assigned" }, { status: 409 });
      }
      data.membershipId = body.membershipId;
    }
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  const updated = await prisma.shelfSpace.update({
    where: { id },
    data,
    include: {
      membership: {
        select: {
          id: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const shelf = await prisma.shelfSpace.findUnique({ where: { id } });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  if (shelf.membershipId) {
    return NextResponse.json(
      { error: "Unassign this shelf before deleting it" },
      { status: 409 },
    );
  }

  await prisma.shelfSpace.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
