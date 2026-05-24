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
    trigger?: string;
    channel?: string;
    subject?: string;
    body?: string;
    isActive?: boolean;
    locationId?: string;
  };

  const template = await prisma.transactionalTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.trigger !== undefined && { trigger: body.trigger }),
      ...(body.channel !== undefined && { channel: body.channel }),
      ...(body.subject !== undefined && { subject: body.subject }),
      ...(body.body !== undefined && { body: body.body }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.locationId !== undefined && { locationId: body.locationId || null }),
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.transactionalTemplate.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
