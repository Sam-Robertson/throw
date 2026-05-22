import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userIdFilter = searchParams.get("userId");

  const logs = await prisma.smsLog.findMany({
    where: userIdFilter ? { userId: userIdFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const userIds = [...new Set(logs.map((l) => l.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const result = logs.map((l) => ({ ...l, user: userMap[l.userId] ?? null }));

  return NextResponse.json(result);
}
