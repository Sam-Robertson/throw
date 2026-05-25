import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireStaff() {
  const session = await auth();
  if (!session)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "triggerEvent", "delayMinutes", "messageTemplate", "locationId"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await prisma.smsAutomation.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;
  const { id } = await params;
  await prisma.smsAutomation.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
