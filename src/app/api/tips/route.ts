import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const MIN_TIP_CENTS = 100; // $1.00
const MAX_TIP_CENTS = 10000; // $100.00

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.bookingId || typeof body.amountInCents !== "number") {
    return NextResponse.json(
      { error: "bookingId and amountInCents are required" },
      { status: 400 },
    );
  }

  const { bookingId, amountInCents } = body as {
    bookingId: string;
    amountInCents: number;
  };

  // Validate amount
  if (
    !Number.isInteger(amountInCents) ||
    amountInCents < MIN_TIP_CENTS ||
    amountInCents > MAX_TIP_CENTS
  ) {
    return NextResponse.json(
      { error: `Tip must be between $1 and $100` },
      { status: 400 },
    );
  }

  // Load booking with session + instructor + location
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true } },
          instructor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  const now = new Date();
  if (booking.studioSession.endsAt >= now) {
    return NextResponse.json(
      { error: "Session has not ended yet" },
      { status: 400 },
    );
  }

  if (!booking.studioSession.instructorId || !booking.studioSession.instructor) {
    return NextResponse.json(
      { error: "No instructor assigned to this session" },
      { status: 400 },
    );
  }

  if (!booking.studioSession.locationId) {
    return NextResponse.json(
      { error: "Session has no location on file" },
      { status: 400 },
    );
  }

  // Check tip already exists for this booking
  const existingTip = await prisma.tip.findFirst({
    where: { bookingId },
  });
  if (existingTip) {
    return NextResponse.json(
      { error: "You already left a tip for this booking" },
      { status: 409 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const instructorName =
    booking.studioSession.instructor.name ?? "your instructor";
  const sessionName = booking.studioSession.sessionType.name;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountInCents,
          product_data: {
            name: `Tip for ${instructorName}`,
            description: `${sessionName} — thank you!`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "tip",
      bookingId,
      userId: session.user.id,
      instructorId: booking.studioSession.instructorId,
      locationId: booking.studioSession.locationId,
    },
    success_url: `${origin}/bookings?tipped=1`,
    cancel_url: `${origin}/bookings/${bookingId}/tip`,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
