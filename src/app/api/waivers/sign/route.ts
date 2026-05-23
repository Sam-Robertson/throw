import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();
  const { waiverVersionId, typedName, signatureImageData } = body as {
    waiverVersionId?: string;
    typedName?: string;
    signatureImageData?: string;
  };

  if (!waiverVersionId)
    return NextResponse.json({ error: "waiverVersionId is required" }, { status: 400 });

  const existing = await prisma.waiverSignature.findUnique({
    where: { userId_waiverVersionId: { userId, waiverVersionId } },
  });
  if (existing)
    return NextResponse.json({ error: "Already signed" }, { status: 409 });

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

  const signature = await prisma.waiverSignature.create({
    data: {
      userId,
      waiverVersionId,
      signedAt: new Date(),
      ipAddress,
      typedName: typedName ?? null,
      signatureImageData: signatureImageData ?? null,
    },
  });

  return NextResponse.json({ success: true, signatureId: signature.id });
}
