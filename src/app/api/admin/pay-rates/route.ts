import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payRates = await prisma.payRate.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(payRates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    userId: string;
    rateType: string;
    amountCents: number;
    notes?: string;
  };

  if (!body.userId || !body.amountCents) {
    return NextResponse.json({ error: "userId and amountCents are required" }, { status: 400 });
  }

  const payRate = await prisma.payRate.create({
    data: {
      userId: body.userId,
      rateType: body.rateType ?? "hourly",
      amountCents: body.amountCents,
      notes: body.notes ?? null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(payRate, { status: 201 });
}
