import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionToken?: string;
    userId?: string;
  };

  if (!body.sessionToken || !body.userId) {
    return NextResponse.json({ success: true });
  }

  const tracking = await prisma.adTracking.findFirst({
    where: { sessionId: body.sessionToken },
  });

  if (tracking && !tracking.userId) {
    await prisma.adTracking.update({
      where: { id: tracking.id },
      data: { userId: body.userId },
    });
  }

  return NextResponse.json({ success: true });
}
