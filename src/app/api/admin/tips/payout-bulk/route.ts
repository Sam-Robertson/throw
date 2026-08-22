import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { tipIds?: unknown } | null;
  const tipIds = body?.tipIds;
  if (!Array.isArray(tipIds) || tipIds.length === 0) {
    return NextResponse.json({ error: "tipIds is required" }, { status: 400 });
  }

  const result = await prisma.tip.updateMany({
    where: { id: { in: tipIds as string[] }, paidOutAt: null },
    data: { paidOutAt: new Date() },
  });

  return NextResponse.json({ updatedCount: result.count });
}
