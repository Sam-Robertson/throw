import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const channel = searchParams.get("channel");
  const reason = searchParams.get("reason");

  const entries = await prisma.suppressionEntry.findMany({
    where: {
      ...(search ? { value: { contains: search, mode: "insensitive" } } : {}),
      ...(channel ? { channel } : {}),
      ...(reason ? { reason } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(entries.filter((e) => e.userId).map((e) => e.userId as string))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      channel: e.channel,
      value: e.value,
      reason: e.reason,
      userId: e.userId,
      userName: e.userId ? (userMap.get(e.userId)?.name ?? userMap.get(e.userId)?.email ?? null) : null,
      note: e.note,
      createdAt: e.createdAt,
    })),
  );
}
