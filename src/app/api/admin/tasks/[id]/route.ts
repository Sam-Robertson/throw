import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true, email: true } },
  linkedCustomer: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const isAdmin = session.user.role === "ADMIN";

  const data: Record<string, unknown> = {};

  // Staff can only update status and assignedToId
  if ("status" in body) {
    data.status = body.status;
    if (body.status === "DONE") data.completedAt = new Date();
  }
  if ("assignedToId" in body) data.assignedToId = body.assignedToId || null;

  // Admin can also update these fields
  if (isAdmin) {
    if ("title" in body) data.title = body.title;
    if ("description" in body) data.description = body.description || null;
    if ("linkedCustomerId" in body)
      data.linkedCustomerId = body.linkedCustomerId || null;
    if ("dueAt" in body) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  }

  const task = await prisma.staffTask.update({
    where: { id },
    data,
    include: taskIncludes,
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });

  const { id } = await params;
  await prisma.staffTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
