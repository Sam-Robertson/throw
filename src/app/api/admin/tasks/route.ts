import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true, email: true } },
  linkedCustomer: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

async function requireStaff() {
  const session = await auth();
  if (!session)
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session, error: null };
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10));

  const where: Record<string, unknown> = {};

  if (status && status !== "ALL") where.status = status;
  if (assignedToId === "unassigned") {
    where.assignedToId = null;
  } else if (assignedToId && assignedToId !== "all") {
    where.assignedToId = assignedToId;
  }
  if (customerId) where.linkedCustomerId = customerId;

  void session;

  const tasks = await prisma.staffTask.findMany({
    where,
    include: taskIncludes,
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireStaff();
  if (error || !session) return error!;

  const { title, description, assignedToId, linkedCustomerId, dueAt } =
    await request.json();

  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const task = await prisma.staffTask.create({
    data: {
      title,
      description: description || null,
      assignedToId: assignedToId || null,
      linkedCustomerId: linkedCustomerId || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdById: session.user.id,
      triggerType: "MANUAL",
    },
    include: taskIncludes,
  });

  return NextResponse.json(task, { status: 201 });
}
