import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const activeVersion = await prisma.waiverVersion.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (!activeVersion) {
    return NextResponse.json({
      hasSigned: true,
      waiverVersionId: null,
      activeVersionId: null,
    });
  }

  const signature = await prisma.waiverSignature.findUnique({
    where: {
      userId_waiverVersionId: { userId, waiverVersionId: activeVersion.id },
    },
    select: { id: true },
  });

  return NextResponse.json({
    hasSigned: signature !== null,
    waiverVersionId: signature?.id ?? null,
    activeVersionId: activeVersion.id,
  });
}
