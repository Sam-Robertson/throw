import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

// App Router reads raw body via req.text() — no bodyParser config needed
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const { userId, studioSessionId } = checkoutSession.metadata ?? {};

    if (!userId || !studioSessionId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const studioSession = await prisma.studioSession.findUnique({
      where: { id: studioSessionId },
      include: {
        _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
      },
    });

    if (!studioSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    const confirmedCount = studioSession._count.bookings;
    const bookingStatus =
      confirmedCount >= studioSession.capacity ? "WAITLIST" : "CONFIRMED";

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : (checkoutSession.payment_intent?.id ?? null);

    const amountPaid = checkoutSession.amount_total ?? 0;

    const booking = await prisma.booking.create({
      data: {
        userId,
        studioSessionId,
        status: bookingStatus,
        source: "DROP_IN",
        stripePaymentIntentId: paymentIntentId,
        amountPaidCents: amountPaid,
      },
    });

    if (studioSession.locationId && paymentIntentId) {
      await prisma.payment
        .create({
          data: {
            userId,
            locationId: studioSession.locationId,
            stripePaymentIntentId: paymentIntentId,
            amountInCents: amountPaid,
            status: "SUCCEEDED",
            type: "DROP_IN",
            bookingId: booking.id,
          },
        })
        .catch(() => {
          // Idempotency: ignore if payment record already exists
        });
    }
  }

  return NextResponse.json({ received: true });
}
