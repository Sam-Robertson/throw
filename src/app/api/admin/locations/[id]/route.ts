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
    address?: string;
    timezone?: string;
    isActive?: boolean;
  };

  const location = await prisma.location.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(location);
}
