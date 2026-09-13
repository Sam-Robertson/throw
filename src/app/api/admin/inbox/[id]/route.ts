import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scopeAllowsUnassigned } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

const NOT_VISIBLE = { error: "This conversation belongs to a studio you don't have access to" };

// GET /api/admin/inbox/[id] — fetch conversation + all messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, conversation.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  return NextResponse.json(conversation);
}

// PATCH /api/admin/inbox/[id] — mark as read
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;

  const existing = await prisma.conversation.findUnique({
    where: { id },
    select: { locationId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id },
      data: { adminUnread: 0 },
    }),
    prisma.conversationMessage.updateMany({
      where: { conversationId: id, isRead: false },
      data: { isRead: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
