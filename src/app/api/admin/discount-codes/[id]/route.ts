import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    description?: string;
    type?: string;
    value?: number;
    maxUses?: number | null;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive?: boolean;
    locationId?: string;
  };

  const code = await prisma.discountCode.update({
    where: { id },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.maxUses !== undefined && { maxUses: body.maxUses }),
      ...(body.validFrom !== undefined && { validFrom: body.validFrom ? new Date(body.validFrom) : null }),
      ...(body.validUntil !== undefined && { validUntil: body.validUntil ? new Date(body.validUntil) : null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.locationId !== undefined && { locationId: body.locationId || null }),
    },
  });

  return NextResponse.json(code);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.discountCode.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
