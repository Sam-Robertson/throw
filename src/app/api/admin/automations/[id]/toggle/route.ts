import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const current = await prisma.smsAutomation.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!current)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.smsAutomation.update({
    where: { id },
    data: { isActive: !current.isActive },
  });

  return NextResponse.json(updated);
}
