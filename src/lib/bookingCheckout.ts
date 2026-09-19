import { prisma } from "@/lib/prisma";
import { calculateDiscounts } from "@/lib/discounts";
import { findGiftCardByCode, refuseDiscount } from "@/lib/pos";

/**
 * Promo codes and gift cards at online class checkout
 * (/api/bookings/checkout and the Stripe webhook).
 *
 * A promo code is a DiscountCode applied via CODE whose scope covers classes;
 * it goes through the same rules and the same engine as the POS. A gift card
 * is a tender, not a discount: it pays for what is left after the promo code.
 *
 * Nothing is deducted or recorded when the customer is only quoted or sent to
 * Stripe. The gift card balance and the redemption are written once, by
 * recordBookingTenders, when the booking exists: straight away if the gift
 * card (or a 100% code) covers everything, otherwise from the webhook after
 * the card payment succeeds.
 */

/** Stripe won't take a card payment under $0.50. */
const STRIPE_MINIMUM_CENTS = 50;

export interface BookingQuote {
  listPriceCents: number;
  discount: { id: string; code: string; name: string; amountCents: number } | null;
  giftCard: { id: string; appliedCents: number; balanceCents: number } | null;
  /** What is left to pay by card. Zero means no Stripe checkout at all. */
  totalCents: number;
}

export type BookingQuoteResult =
  | { ok: true; quote: BookingQuote }
  | { ok: false; status: number; error: string; message: string };

export async function quoteOnlineBooking(args: {
  userId: string;
  locationId: string | null;
  sessionTypeId: string;
  priceCents: number;
  promoCode?: string | null;
  giftCardCode?: string | null;
}): Promise<BookingQuoteResult> {
  let discount: BookingQuote["discount"] = null;

  const code = args.promoCode?.trim().toUpperCase();
  if (code) {
    const row = await prisma.discountCode.findUnique({ where: { code } });
    // Staff-applied and automatic discounts are not promo codes, whatever is typed.
    if (!row || row.appliesVia !== "CODE" || !["CLASSES", "EVERYTHING"].includes(row.scope)) {
      return { ok: false, status: 404, error: "PROMO_NOT_FOUND", message: "That promo code isn't valid." };
    }
    const refusal = await refuseDiscount(row, { locationId: args.locationId, customerId: args.userId });
    if (refusal) return { ok: false, status: 409, ...refusal };

    const priced = calculateDiscounts(
      [
        {
          id: "class",
          itemType: "DROP_IN",
          category: null,
          sessionTypeId: args.sessionTypeId,
          quantity: 1,
          unitPriceCents: args.priceCents,
        },
      ],
      [{ ...row, id: row.id, automatic: false }],
      { commitmentMonths: null, isGroupEventOrder: false },
    );
    const amountCents = priced.discountAmounts[row.id] ?? 0;
    if (amountCents <= 0) {
      return {
        ok: false,
        status: 409,
        error: "PROMO_NOT_APPLICABLE",
        message: "That promo code doesn't apply to this class.",
      };
    }
    discount = { id: row.id, code: row.code, name: row.name ?? row.code, amountCents };
  }

  let totalCents = args.priceCents - (discount?.amountCents ?? 0);
  let giftCard: BookingQuote["giftCard"] = null;

  if (args.giftCardCode?.trim()) {
    const card = await findGiftCardByCode(args.giftCardCode);
    if (!card || !card.isActive) {
      return { ok: false, status: 404, error: "GIFT_CARD_NOT_FOUND", message: "That gift card code isn't valid." };
    }
    // Cards issued here never expire; an imported card may carry a date.
    if (card.expiresAt && card.expiresAt < new Date()) {
      return { ok: false, status: 409, error: "GIFT_CARD_EXPIRED", message: "That gift card has expired." };
    }
    if (card.balanceCents <= 0) {
      return { ok: false, status: 409, error: "GIFT_CARD_EMPTY", message: "That gift card has no balance left." };
    }

    let appliedCents = Math.min(card.balanceCents, totalCents);
    // Leave at least Stripe's minimum for the card, rather than a few cents it can't charge.
    const left = totalCents - appliedCents;
    if (left > 0 && left < STRIPE_MINIMUM_CENTS) {
      appliedCents = Math.max(0, appliedCents - (STRIPE_MINIMUM_CENTS - left));
    }
    if (appliedCents > 0) {
      giftCard = { id: card.id, appliedCents, balanceCents: card.balanceCents };
      totalCents -= appliedCents;
    }
  }

  if (totalCents > 0 && totalCents < STRIPE_MINIMUM_CENTS) {
    return {
      ok: false,
      status: 409,
      error: "AMOUNT_TOO_SMALL",
      message: "The amount left to pay is too small to charge to a card. Please contact the studio.",
    };
  }

  return { ok: true, quote: { listPriceCents: args.priceCents, discount, giftCard, totalCents } };
}

/** What the checkout session carries to the webhook (Stripe metadata values are strings). */
export function tenderMetadata(quote: BookingQuote): Record<string, string> {
  return {
    listPriceCents: String(quote.listPriceCents),
    ...(quote.discount
      ? { discountCodeId: quote.discount.id, discountCents: String(quote.discount.amountCents) }
      : {}),
    ...(quote.giftCard
      ? { giftCardId: quote.giftCard.id, giftCardCents: String(quote.giftCard.appliedCents) }
      : {}),
  };
}

export function parseTenderMetadata(metadata: Record<string, string | undefined>) {
  const cents = (value: string | undefined) => {
    const n = value ? parseInt(value, 10) : 0;
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  return {
    discountCodeId: metadata.discountCodeId || null,
    discountCents: cents(metadata.discountCents),
    giftCardId: metadata.giftCardId || null,
    giftCardCents: cents(metadata.giftCardCents),
  };
}

/**
 * Writes the promo code redemption and takes the gift card amount, once the
 * booking exists. Call exactly once per booking (the webhook guards on the
 * payment intent; the free path creates the booking in the same request).
 *
 * The gift card decrement is atomic. If the balance was spent elsewhere
 * between checkout and payment, what is left is taken and the shortfall is
 * returned (and logged) for staff to follow up — the class is already paid for
 * and booked, so this never throws.
 */
export async function recordBookingTenders(args: {
  bookingId: string;
  userId: string;
  discountCodeId: string | null;
  discountCents: number;
  giftCardId: string | null;
  giftCardCents: number;
}): Promise<{ giftCardChargedCents: number; giftCardShortfallCents: number }> {
  if (args.discountCodeId && args.discountCents > 0) {
    try {
      await prisma.$transaction([
        prisma.discountRedemption.create({
          data: {
            discountCodeId: args.discountCodeId,
            userId: args.userId,
            bookingId: args.bookingId,
            amountCents: args.discountCents,
            note: "Online class checkout",
          },
        }),
        prisma.discountCode.update({
          where: { id: args.discountCodeId },
          data: { usedCount: { increment: 1 } },
        }),
      ]);
    } catch (err) {
      console.error(`[booking checkout] failed to record promo redemption for booking ${args.bookingId}:`, err);
    }
  }

  let charged = 0;
  if (args.giftCardId && args.giftCardCents > 0) {
    try {
      const full = await prisma.giftCard.updateMany({
        where: { id: args.giftCardId, balanceCents: { gte: args.giftCardCents } },
        data: { balanceCents: { decrement: args.giftCardCents }, redeemedById: args.userId },
      });
      if (full.count > 0) {
        charged = args.giftCardCents;
      } else {
        const card = await prisma.giftCard.findUnique({ where: { id: args.giftCardId } });
        const available = Math.max(0, card?.balanceCents ?? 0);
        if (available > 0) {
          const partial = await prisma.giftCard.updateMany({
            where: { id: args.giftCardId, balanceCents: { gte: available } },
            data: { balanceCents: { decrement: available }, redeemedById: args.userId },
          });
          if (partial.count > 0) charged = available;
        }
      }
    } catch (err) {
      console.error(`[booking checkout] failed to charge gift card for booking ${args.bookingId}:`, err);
    }
    if (charged < args.giftCardCents) {
      console.error(
        `[booking checkout] booking ${args.bookingId}: gift card ${args.giftCardId} was short by ${args.giftCardCents - charged} cents`,
      );
    }
  }

  return { giftCardChargedCents: charged, giftCardShortfallCents: Math.max(0, args.giftCardCents - charged) };
}
