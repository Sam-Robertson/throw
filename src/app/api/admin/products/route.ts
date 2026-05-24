import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.retailProduct.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    name: string;
    description?: string;
    priceCents: number;
    sku?: string;
    inventory?: number;
    imageUrl?: string;
    locationId?: string;
  };

  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const product = await prisma.retailProduct.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      priceCents: body.priceCents ?? 0,
      sku: body.sku ?? null,
      inventory: body.inventory ?? 0,
      imageUrl: body.imageUrl ?? null,
      locationId: body.locationId ?? null,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
