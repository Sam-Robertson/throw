import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionToken?: string;
    event?: "booking" | "purchase";
  };

  if (!body.sessionToken || !body.event) {
    return NextResponse.json({ success: true });
  }

  const tracking = await prisma.adTracking.findFirst({
    where: { sessionId: body.sessionToken },
  });

  if (!tracking) return NextResponse.json({ success: true });

  if (body.event === "booking" && !tracking.firstBookingAt) {
    await prisma.adTracking.update({
      where: { id: tracking.id },
      data: { firstBookingAt: new Date() },
    });
  } else if (body.event === "purchase" && !tracking.firstPurchaseAt) {
    await prisma.adTracking.update({
      where: { id: tracking.id },
      data: { firstPurchaseAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
