import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    rateType?: string;
    amountCents?: number;
    notes?: string;
    isActive?: boolean;
  };

  const payRate = await prisma.payRate.update({
    where: { id },
    data: {
      ...(body.rateType !== undefined && { rateType: body.rateType }),
      ...(body.amountCents !== undefined && { amountCents: body.amountCents }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(payRate);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.payRate.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
