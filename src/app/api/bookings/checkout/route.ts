import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { CLASS_PRICE_SELECT, isSellable, resolveClassPriceCents } from "@/lib/sellable";
import { stripe } from "@/lib/stripe";
import { formatMountainTime } from "@/lib/timezone";
import { findUnsignedWaiver } from "@/lib/waivers";
import { sendInngestEvent } from "@/lib/inngest";
import { quoteOnlineBooking, recordBookingTenders, tenderMetadata } from "@/lib/bookingCheckout";

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

  // `promoCode` and `giftCardCode` are optional. `preview: true` prices the
  // booking with them and returns the numbers without booking or charging.
  const { studioSessionId, promoCode, giftCardCode, preview } = body as {
    studioSessionId: string;
    promoCode?: string;
    giftCardCode?: string;
    preview?: boolean;
  };
  const userId = session.user.id;

  const existing = await prisma.booking.findFirst({
    where: { userId, studioSessionId, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already booked" }, { status: 409 });
  }

  const studioSession = await prisma.studioSession.findUnique({
    where: { id: studioSessionId },
    include: { sessionType: { select: { ...CLASS_PRICE_SELECT, name: true } } },
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
  // Paid checkout is only for class types that are actually for sale — never
  // a $0 or retired type. Members book free classes through /api/bookings.
  const priceCents = resolveClassPriceCents({
    sessionType: studioSession.sessionType,
    locationId: studioSession.locationId,
    priceCentsOverride: studioSession.priceCentsOverride,
  });
  if (!isSellable(studioSession.sessionType, priceCents)) {
    return NextResponse.json({ error: "NOT_FOR_SALE" }, { status: 400 });
  }
  if (studioSession.startsAt <= new Date()) {
    return NextResponse.json({ error: "SESSION_IN_PAST" }, { status: 400 });
  }

  const unsignedWaiver = await findUnsignedWaiver(userId, studioSession.locationId);
  if (unsignedWaiver) {
    return NextResponse.json(
      { error: "WAIVER_REQUIRED", waiverVersionId: unsignedWaiver.id },
      { status: 403 },
    );
  }

  // Capacity is checked before taking payment. This is not a reservation — two
  // customers can still both pass here for the last spot — so the webhook's
  // own capacity check (which waitlists an overflow booking) stays as the
  // fallback for that race.
  const confirmedCount = await prisma.booking.count({
    where: { studioSessionId, status: "CONFIRMED" },
  });
  if (confirmedCount >= studioSession.capacity) {
    return NextResponse.json({ error: "SESSION_FULL" }, { status: 409 });
  }

  // Promo code first, then the gift card pays toward what is left. Both are
  // validated here, server side, with the same rules as the POS.
  const quoted = await quoteOnlineBooking({
    userId,
    locationId: studioSession.locationId,
    sessionTypeId: studioSession.sessionTypeId,
    priceCents,
    promoCode,
    giftCardCode,
  });
  if (!quoted.ok) {
    return NextResponse.json({ error: quoted.error, message: quoted.message }, { status: quoted.status });
  }
  const { quote } = quoted;

  if (preview) {
    return NextResponse.json({
      listPriceCents: quote.listPriceCents,
      discount: quote.discount && { code: quote.discount.code, name: quote.discount.name, amountCents: quote.discount.amountCents },
      giftCard: quote.giftCard && {
        appliedCents: quote.giftCard.appliedCents,
        remainingAfterCents: quote.giftCard.balanceCents - quote.giftCard.appliedCents,
      },
      totalCents: quote.totalCents,
    });
  }

  // Nothing left for a card to pay: book now, without Stripe. The gift card is
  // charged first and atomically, so a card spent elsewhere a moment ago can't
  // book a free class.
  if (quote.totalCents === 0) {
    if (quote.giftCard) {
      const { count } = await prisma.giftCard.updateMany({
        where: { id: quote.giftCard.id, isActive: true, balanceCents: { gte: quote.giftCard.appliedCents } },
        data: { balanceCents: { decrement: quote.giftCard.appliedCents }, redeemedById: userId },
      });
      if (count === 0) {
        return NextResponse.json(
          { error: "GIFT_CARD_CHANGED", message: "That gift card's balance just changed. Please try again." },
          { status: 409 },
        );
      }
    }

    const giftCardCents = quote.giftCard?.appliedCents ?? 0;
    const booking = await prisma.booking
      .create({
        data: { userId, studioSessionId, status: "CONFIRMED", source: "DROP_IN", amountPaidCents: giftCardCents },
      })
      .catch(async (err) => {
        // No booking, so the gift card gets its money back before the error surfaces.
        if (quote.giftCard) {
          await prisma.giftCard.update({
            where: { id: quote.giftCard.id },
            data: { balanceCents: { increment: giftCardCents } },
          });
        }
        throw err;
      });
    await recordBookingTenders({
      bookingId: booking.id,
      userId,
      discountCodeId: quote.discount?.id ?? null,
      discountCents: quote.discount?.amountCents ?? 0,
      // Already charged above.
      giftCardId: null,
      giftCardCents: 0,
    });
    // The gift card redemption, recorded the way every other class payment is.
    if (quote.giftCard && studioSession.locationId) {
      await prisma.payment
        .create({
          data: {
            userId,
            locationId: studioSession.locationId,
            stripePaymentIntentId: `giftcard_${booking.id}`,
            amountInCents: giftCardCents,
            status: "SUCCEEDED",
            type: "DROP_IN",
            bookingId: booking.id,
            metadata: { tender: "GIFT_CARD", giftCardId: quote.giftCard.id, giftCardCents },
          },
        })
        .catch((err) => console.error(`[booking checkout] payment record failed for booking ${booking.id}:`, err));
    }
    await sendInngestEvent({
      name: "booking/confirmed",
      data: { bookingId: booking.id, userId, studioSessionId },
    });

    return NextResponse.json({ booked: true, bookingId: booking.id, url: `/booking/success?booking_id=${booking.id}` });
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
          // The card pays what is left after the promo code and the gift card.
          unit_amount: quote.totalCents,
          product_data: {
            name: studioSession.sessionType.name,
            description: [
              formatMountainTime(studioSession.startsAt, "datetime"),
              quote.discount ? `${quote.discount.code} −$${(quote.discount.amountCents / 100).toFixed(2)}` : null,
              quote.giftCard ? `gift card −$${(quote.giftCard.appliedCents / 100).toFixed(2)}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        },
        quantity: 1,
      },
    ],
    // The webhook redeems the promo code and charges the gift card from this,
    // only once the card payment has succeeded.
    metadata: { userId, studioSessionId, ...tenderMetadata(quote) },
    success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/schedule/${studioSessionId}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
