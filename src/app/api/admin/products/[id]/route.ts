import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    description?: string;
    priceCents?: number;
    sku?: string;
    inventory?: number;
    imageUrl?: string;
    isActive?: boolean;
    locationId?: string;
  };

  const product = await prisma.retailProduct.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.priceCents !== undefined && { priceCents: body.priceCents }),
      ...(body.sku !== undefined && { sku: body.sku }),
      ...(body.inventory !== undefined && { inventory: body.inventory }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.locationId !== undefined && { locationId: body.locationId || null }),
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.retailProduct.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
