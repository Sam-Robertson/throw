import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    code: string;
    description?: string;
    type?: string;
    value: number;
    maxUses?: number;
    validFrom?: string;
    validUntil?: string;
    locationId?: string;
  };

  if (!body.code || body.value === undefined) {
    return NextResponse.json({ error: "code and value are required" }, { status: 400 });
  }

  const existing = await prisma.discountCode.findUnique({ where: { code: body.code.toUpperCase() } });
  if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 409 });

  const code = await prisma.discountCode.create({
    data: {
      code: body.code.toUpperCase(),
      description: body.description ?? null,
      type: body.type ?? "percent",
      value: body.value,
      maxUses: body.maxUses ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      locationId: body.locationId ?? null,
    },
  });

  return NextResponse.json(code, { status: 201 });
}
