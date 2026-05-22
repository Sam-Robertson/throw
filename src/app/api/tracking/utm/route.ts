import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionToken?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    landingPath?: string;
  };

  if (!body.sessionToken) {
    return NextResponse.json({ success: true });
  }

  const existing = await prisma.adTracking.findFirst({
    where: { sessionId: body.sessionToken },
  });

  if (existing) {
    await prisma.adTracking.update({
      where: { id: existing.id },
      data: {
        ...(existing.utmSource === null && body.utmSource && { utmSource: body.utmSource }),
        ...(existing.utmMedium === null && body.utmMedium && { utmMedium: body.utmMedium }),
        ...(existing.utmCampaign === null && body.utmCampaign && { utmCampaign: body.utmCampaign }),
        ...(existing.utmContent === null && body.utmContent && { utmContent: body.utmContent }),
        ...(existing.utmTerm === null && body.utmTerm && { utmTerm: body.utmTerm }),
      },
    });
  } else {
    await prisma.adTracking.create({
      data: {
        sessionId: body.sessionToken,
        utmSource: body.utmSource ?? null,
        utmMedium: body.utmMedium ?? null,
        utmCampaign: body.utmCampaign ?? null,
        utmContent: body.utmContent ?? null,
        utmTerm: body.utmTerm ?? null,
      },
    });
  }

  return NextResponse.json({ success: true });
}
