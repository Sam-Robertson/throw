import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templates = await prisma.transactionalTemplate.findMany({
    orderBy: [{ channel: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    name: string;
    description?: string;
    trigger: string;
    channel?: string;
    subject?: string;
    body: string;
    locationId?: string;
  };

  if (!body.name || !body.trigger || !body.body) {
    return NextResponse.json({ error: "name, trigger, and body are required" }, { status: 400 });
  }

  const template = await prisma.transactionalTemplate.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      channel: body.channel ?? "email",
      subject: body.subject ?? null,
      body: body.body,
      locationId: body.locationId ?? null,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
