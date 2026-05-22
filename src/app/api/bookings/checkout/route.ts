import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { formatMountainTime } from "@/lib/timezone";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.studioSessionId) {
    return NextResponse.json(
      { error: "studioSessionId is required" },
      { status: 400 },
    );
  }

  const { studioSessionId } = body as { studioSessionId: string };
  const userId = session.user.id;

  const existing = await prisma.booking.findFirst({
    where: { userId, studioSessionId, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already booked" }, { status: 409 });
  }

  const studioSession = await prisma.studioSession.findUnique({
    where: { id: studioSessionId },
    include: { sessionType: true },
  });
  if (!studioSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (studioSession.isCancelled) {
    return NextResponse.json(
      { error: "Session is cancelled" },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: studioSession.sessionType.dropInPriceCents,
          product_data: {
            name: studioSession.sessionType.name,
            description: formatMountainTime(studioSession.startsAt, "datetime"),
          },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, studioSessionId },
    success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schedule/${studioSessionId}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
