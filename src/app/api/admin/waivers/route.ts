import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const versions = await prisma.waiverVersion.findMany({
    orderBy: { version: "desc" },
    include: {
      _count: { select: { signatures: true } },
    },
  });

  return NextResponse.json(versions);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content, locationId } = await request.json();

  if (!content?.trim())
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  if (!locationId)
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });

  const latest = await prisma.waiverVersion.findFirst({
    where: { locationId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const waiverVersion = await prisma.$transaction(async (tx) => {
    await tx.waiverVersion.updateMany({
      where: { locationId, isActive: true },
      data: { isActive: false },
    });

    return tx.waiverVersion.create({
      data: {
        locationId,
        content,
        version: nextVersion,
        publishedAt: new Date(),
        isActive: true,
      },
    });
  });

  return NextResponse.json(waiverVersion, { status: 201 });
}
