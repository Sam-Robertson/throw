import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      payRates: {
        where: { isActive: true },
        select: { id: true, rateType: true, amountCents: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      defaultPayRate: u.payRates[0] ?? null,
    })),
  );
}
