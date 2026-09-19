import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    balanceCents?: number;
    expiresAt?: string | null;
    isActive?: boolean;
  };

  const giftCard = await prisma.giftCard.update({
    where: { id },
    data: {
      ...(typeof body.balanceCents === "number" &&
        Number.isInteger(body.balanceCents) &&
        body.balanceCents >= 0 && { balanceCents: body.balanceCents }),
      ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(giftCard);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Never deleted: POS payments and redemptions point at the card. Deactivating
  // stops it being used and keeps its history.
  const { id } = await params;
  const giftCard = await prisma.giftCard.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json(giftCard);
}
