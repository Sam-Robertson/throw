import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const giftCards = await prisma.giftCard.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(giftCards);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    code: string;
    initialCents: number;
    expiresAt?: string;
    locationId?: string;
  };

  if (!body.code || !body.initialCents) {
    return NextResponse.json({ error: "code and initialCents are required" }, { status: 400 });
  }

  const existing = await prisma.giftCard.findUnique({ where: { code: body.code.toUpperCase() } });
  if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 409 });

  const giftCard = await prisma.giftCard.create({
    data: {
      code: body.code.toUpperCase(),
      initialCents: body.initialCents,
      balanceCents: body.initialCents,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      locationId: body.locationId ?? null,
    },
  });

  return NextResponse.json(giftCard, { status: 201 });
}
