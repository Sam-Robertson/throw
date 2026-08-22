import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const shelfType = searchParams.get("shelfType");
  const q = searchParams.get("q")?.trim() ?? "";

  if (shelfType !== "FULL" && shelfType !== "HALF") {
    return NextResponse.json({ error: "shelfType must be FULL or HALF" }, { status: 400 });
  }
  if (!q) return NextResponse.json([]);

  const memberships = await prisma.membership.findMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED"] },
      plan: { shelfType },
      shelfSpace: null,
      user: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    select: {
      id: true,
      status: true,
      plan: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    take: 10,
  });

  return NextResponse.json(
    memberships.map((m) => ({
      membershipId: m.id,
      status: m.status,
      planName: m.plan.name,
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
    })),
  );
}
