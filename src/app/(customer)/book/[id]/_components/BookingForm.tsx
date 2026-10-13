'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/site/Button';
import { Field } from '@/components/site/Field';

type BookingError = { message: string; waiverVersionId?: string };
type ErrorBody = { error?: string; message?: string; waiverVersionId?: string };

// What /api/bookings/checkout returns for `preview: true`.
type Quote = {
  listPriceCents: number;
  discount: { code: string; name: string; amountCents: number } | null;
  giftCard: { appliedCents: number; remainingAfterCents: number } | null;
  totalCents: number;
};

function describeError(data: ErrorBody): BookingError {
  switch (data.error) {
    case 'WAIVER_REQUIRED':
      return {
        message: "You need to sign this studio's waiver before you can book.",
        waiverVersionId: data.waiverVersionId,
      };
    case 'SESSION_FULL':
      return {
        message:
          "This class just filled up, so you haven't been charged. Please pick another time.",
      };
    case 'SESSION_IN_PAST':
      return { message: 'This class has already started and can no longer be booked.' };
    case 'NOT_TICKET_ELIGIBLE':
      return { message: "This class can't be booked with a class ticket." };
    default:
      return { message: data.message ?? data.error ?? 'Something went wrong. Please try again.' };
  }
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

type Props = {
  sessionId: string;
  hasMembership: boolean;
  membershipUnlimited: boolean;
  ticketsRemaining: number | null;
  dropInPriceCents: number;
  /** False for $0 or retired class types: no paid drop-in, members only. */
  forSale: boolean;
  spotsRemaining: number;
};

/**
 * The booking action on a class page. Members with a ticket book with one
 * tap ("Book with 1 class ticket"); everyone else pays the drop-in price
 * through Stripe Checkout, with an optional promo code or gift card.
 */
export function BookingForm({
  sessionId,
  hasMembership,
  membershipUnlimited,
  ticketsRemaining,
  dropInPriceCents,
  forSale,
  spotsRemaining,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<BookingError | null>(null);
  // Flips to true if the server rejects with NO_TICKETS_REMAINING (a race
  // with another tab) so the paid path is offered instead.
  const [forceDropIn, setForceDropIn] = useState(false);
  const [sessionFull, setSessionFull] = useState(spotsRemaining <= 0);
  const [promoCode, setPromoCode] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);

  const outOfTickets =
    hasMembership && !membershipUnlimited && (forceDropIn || (ticketsRemaining ?? 0) <= 0);
  const memberFlow = hasMembership && !outOfTickets;

  async function bookWithTicket() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioSessionId: sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (res.status === 402 && data.error === 'NO_TICKETS_REMAINING') {
          setForceDropIn(true);
          return;
        }
        setError(describeError(data));
        return;
      }
      const { bookingId } = (await res.json()) as { bookingId: string };
      router.push(`/bookings/${bookingId}/confirmed`);
    } catch {
      setError({ message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  const codes = {
    promoCode: promoCode.trim() || undefined,
    giftCardCode: giftCardCode.trim() || undefined,
  };

  async function applyCodes() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioSessionId: sessionId, ...codes, preview: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (data.error === 'SESSION_FULL') setSessionFull(true);
        setQuote(null);
        setError(describeError(data));
        return;
      }
      setQuote((await res.json()) as Quote);
    } catch {
      setError({ message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  async function payDropIn() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioSessionId: sessionId, ...codes }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (data.error === 'SESSION_FULL') setSessionFull(true);
        setError(describeError(data));
        return;
      }
      const { url, booked } = (await res.json()) as { url: string; booked?: boolean };
      if (booked) {
        router.push(url);
        return;
      }
      window.location.href = url;
    } catch {
      setError({ message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  const waiverHref = error?.waiverVersionId
    ? `/waiver?${new URLSearchParams({
        versionId: error.waiverVersionId,
        callbackUrl: `/book/${sessionId}`,
      }).toString()}`
    : null;

  const totalCents = quote?.totalCents ?? dropInPriceCents;

  return (
    <div>
      {error && (
        <p className="mb-4 text-[14px] leading-5 text-[#ff2d55]">
          {error.message}
          {waiverHref && (
            <>
              {' '}
              <NextLink href={waiverHref} className="font-bold underline underline-offset-4">
                Sign the waiver
              </NextLink>
            </>
          )}
        </p>
      )}

      {memberFlow ? (
        <>
          <Button block onClick={bookWithTicket} disabled={pending}>
            {pending
              ? 'Booking…'
              : sessionFull
                ? 'Join the waitlist'
                : membershipUnlimited
                  ? 'Book this class'
                  : 'Book with 1 class ticket'}
          </Button>
          {!membershipUnlimited && ticketsRemaining !== null && (
            <p className="text-body mt-3 text-center text-[13px] leading-5">
              {ticketsRemaining} {ticketsRemaining === 1 ? 'ticket' : 'tickets'} left this month
            </p>
          )}
        </>
      ) : !forSale ? (
        <p className="t-body-sm text-body">
          This class is for members only.{' '}
          <NextLink
            href="/membership/pick"
            className="t-body-sm-bold text-headline underline underline-offset-4"
          >
            Start a membership
          </NextLink>
        </p>
      ) : sessionFull ? (
        <p className="t-body-sm text-body">This class is full. Pick another time from the list.</p>
      ) : (
        <>
          {outOfTickets && (
            <p className="text-body mb-3 text-[14px] leading-5">
              You’ve used your class tickets for this month. You can still book this class at the
              drop-in price.
            </p>
          )}

          {codesOpen ? (
            <div className="mb-4 flex flex-col gap-3">
              <Field
                label="Promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
              <Field
                label="Gift card"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value)}
              />
              <Button variant="secondary" block onClick={applyCodes} disabled={pending}>
                Apply
              </Button>
              {quote && (quote.discount || quote.giftCard) && (
                <p className="text-body text-[13px] leading-5">
                  {quote.discount &&
                    `${quote.discount.name}: −${formatPrice(quote.discount.amountCents)}. `}
                  {quote.giftCard && `Gift card: −${formatPrice(quote.giftCard.appliedCents)}.`}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCodesOpen(true)}
              className="t-body-sm-bold text-headline mb-4 underline underline-offset-4"
            >
              Have a promo code or gift card?
            </button>
          )}

          <Button block onClick={payDropIn} disabled={pending}>
            {pending ? 'One moment…' : `Pay ${formatPrice(totalCents)} and book`}
          </Button>
        </>
      )}

      <p className="text-body mt-5 text-center text-[13px] leading-5">
        Plans change? Cancel at least 2 hours ahead so another member can take your spot.
      </p>
    </div>
  );
}
