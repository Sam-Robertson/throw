import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const tip = await prisma.tip.findUnique({ where: { id } });
  if (!tip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tip.paidOutAt) {
    return NextResponse.json({ error: "Tip already paid out" }, { status: 409 });
  }

  const updated = await prisma.tip.update({
    where: { id },
    data: { paidOutAt: new Date() },
  });

  return NextResponse.json(updated);
}
