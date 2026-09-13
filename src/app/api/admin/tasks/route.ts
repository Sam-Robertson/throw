import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  locationWhereOrUnassigned,
  resolveLocationScope,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true, email: true } },
  linkedCustomer: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guard = await requireStaffScope(searchParams.get("locationId"));
  if (guard.error) return guard.error;

  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10));

  // Tasks without a studio (every manually created task before this change,
  // and any created from the franchise view) stay visible to every studio.
  const where: Record<string, unknown> = { ...locationWhereOrUnassigned(guard.scope) };

  if (status && status !== "ALL") where.status = status;
  if (assignedToId === "unassigned") {
    where.assignedToId = null;
  } else if (assignedToId && assignedToId !== "all") {
    where.assignedToId = assignedToId;
  }
  if (customerId) where.linkedCustomerId = customerId;

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
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;
  const { session } = guard;

  const { title, description, assignedToId, linkedCustomerId, dueAt, locationId } =
    (await request.json()) as {
      title?: string;
      description?: string | null;
      assignedToId?: string | null;
      linkedCustomerId?: string | null;
      dueAt?: string | null;
      locationId?: string | null;
    };

  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  // Tag the task with the studio it was created from, if the user may use it.
  if (locationId) {
    try {
      resolveLocationScope(session, locationId);
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  const task = await prisma.staffTask.create({
    data: {
      title,
      locationId: locationId || null,
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
