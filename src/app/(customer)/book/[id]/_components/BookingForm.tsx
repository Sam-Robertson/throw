"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BookingError = { message: string; waiverVersionId?: string };

type ErrorBody = { error?: string; message?: string; waiverVersionId?: string };

// What /api/bookings/checkout returns for `preview: true`.
type Quote = {
  listPriceCents: number;
  discount: { code: string; name: string; amountCents: number } | null;
  giftCard: { appliedCents: number; remainingAfterCents: number } | null;
  totalCents: number;
};

// Maps the booking APIs' error codes to customer-facing copy.
function describeError(data: ErrorBody): BookingError {
  switch (data.error) {
    case "WAIVER_REQUIRED":
      return {
        message: "You need to sign this studio's waiver before you can book.",
        waiverVersionId: data.waiverVersionId,
      };
    case "SESSION_FULL":
      return {
        message:
          "This session just filled up, so you haven't been charged. Please pick another time from the schedule.",
      };
    case "SESSION_IN_PAST":
      return { message: "This session has already started and can no longer be booked." };
    default:
      // Promo code and gift card errors come with their own customer-facing message.
      return { message: data.message ?? data.error ?? "Something went wrong. Please try again." };
  }
}

type Props = {
  sessionId: string;
  hasMembership: boolean;
  membershipUnlimited: boolean;
  ticketsRemaining: number | null;
  ticketAllowance: number | null;
  ticketsResetDate: string | null;
  dropInPriceCents: number;
  /** False for $0 or retired class types: no paid drop-in, members only. */
  forSale: boolean;
  sessionName: string;
  studioName: string | null;
  sessionDate: string;
  sessionTime: string;
  instructorName: string | null;
  durationMinutes: number;
  spotsRemaining: number;
};

// Whole dollars without the cents ($200), anything else in full ($29.99).
function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function BookingForm({
  sessionId,
  hasMembership,
  membershipUnlimited,
  ticketsRemaining,
  ticketAllowance,
  ticketsResetDate,
  dropInPriceCents,
  forSale,
  sessionName,
  studioName,
  sessionDate,
  sessionTime,
  instructorName,
  durationMinutes,
  spotsRemaining,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<BookingError | null>(null);
  // Flips to true if the server disagrees with our client-side ticket count
  // (e.g. a race with another tab) and rejects with NO_TICKETS_REMAINING.
  const [forceDropIn, setForceDropIn] = useState(false);
  // Paid drop-ins are refused once a session is full (no paying to waitlist),
  // either because the page loaded full or the server said SESSION_FULL.
  const [sessionFull, setSessionFull] = useState(spotsRemaining <= 0);
  // Promo code and gift card for a paid drop-in. `quote` is the server's
  // pricing of what is typed; the server prices it again when booking.
  const [promoCode, setPromoCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);

  const outOfTickets =
    hasMembership && !membershipUnlimited && (forceDropIn || (ticketsRemaining ?? 0) <= 0);
  const showMemberFreeFlow = hasMembership && !outOfTickets;

  async function handleMemberFree() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioSessionId: sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (res.status === 402 && data.error === "NO_TICKETS_REMAINING") {
          setForceDropIn(true);
          return;
        }
        setError(describeError(data));
        return;
      }
      router.push("/dashboard?booked=1");
    } catch {
      setError({ message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  const codes = {
    promoCode: promoCode.trim() || undefined,
    giftCardCode: giftCardCode.trim() || undefined,
  };

  async function handleApplyCodes() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioSessionId: sessionId, ...codes, preview: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (data.error === "SESSION_FULL") setSessionFull(true);
        setQuote(null);
        setError(describeError(data));
        return;
      }
      setQuote((await res.json()) as Quote);
    } catch {
      setError({ message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  async function handleDropIn() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioSessionId: sessionId, ...codes }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (data.error === "SESSION_FULL") setSessionFull(true);
        setError(describeError(data));
        return;
      }
      // A gift card (or a 100% code) that covers everything books straight
      // away; otherwise Stripe takes the card for what is left.
      const { url, booked } = (await res.json()) as { url: string; booked?: boolean };
      if (booked) {
        router.push(url);
        return;
      }
      window.location.href = url;
    } catch {
      setError({ message: "Something went wrong. Please try again." });
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

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">Confirm your booking</h1>

      <dl className="mb-6 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-medium">Session</dt>
          <dd className="text-muted-foreground">{sessionName}</dd>
        </div>
        {studioName && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium">Studio</dt>
            <dd className="text-muted-foreground">{studioName}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-medium">Date</dt>
          <dd className="text-muted-foreground">{sessionDate}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-medium">Time</dt>
          <dd className="text-muted-foreground">{sessionTime}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-medium">Duration</dt>
          <dd className="text-muted-foreground">{durationMinutes} min</dd>
        </div>
        {instructorName && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium">Instructor</dt>
            <dd className="text-muted-foreground">{instructorName}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-medium">Spots left</dt>
          <dd className="text-muted-foreground">{spotsRemaining}</dd>
        </div>
      </dl>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{error.message}</p>
          {waiverHref && (
            <Link href={waiverHref} className="mt-1 inline-block font-medium underline underline-offset-4">
              Sign the waiver
            </Link>
          )}
        </div>
      )}

      {showMemberFreeFlow ? (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {membershipUnlimited
              ? "This session is included in your membership — no charge."
              : `This will use 1 of your ${ticketAllowance} ticket${ticketAllowance === 1 ? "" : "s"} (${ticketsRemaining} remaining).`}
          </p>
          <Button onClick={handleMemberFree} disabled={pending} size="lg">
            {pending
              ? "Confirming…"
              : spotsRemaining <= 0
                ? "Join Waitlist (membership)"
                : "Confirm booking (included in your membership)"}
          </Button>
        </div>
      ) : !forSale ? (
        <p className="text-sm text-muted-foreground">
          {hasMembership
            ? "You've used all your class tickets this period, and this class isn't sold as a drop-in."
            : "This class is for members and isn't sold as a drop-in."}{" "}
          <Link href={hasMembership ? "/schedule" : "/membership"} className="underline underline-offset-4">
            {hasMembership ? "See other classes" : "See memberships"}
          </Link>
        </p>
      ) : (
        <div>
          {outOfTickets && (
            <p className="mb-4 text-sm text-muted-foreground">
              You&apos;ve used all your class tickets this period. Book as a drop-in for{" "}
              <span className="font-semibold text-foreground">{formatPrice(dropInPriceCents)}</span>
              {ticketsResetDate ? `, or your tickets reset on ${ticketsResetDate}.` : "."}
            </p>
          )}
          {!hasMembership && !sessionFull && (
            <p className="mb-4 text-sm text-muted-foreground">
              Drop-in price:{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(dropInPriceCents)}
              </span>
            </p>
          )}
          {sessionFull ? (
            <p className="text-sm text-muted-foreground">
              This session is full.{" "}
              <Link href="/schedule" className="underline underline-offset-4">
                See other times
              </Link>
            </p>
          ) : (
            <>
              {!codesOpen ? (
                <button
                  type="button"
                  onClick={() => setCodesOpen(true)}
                  className="mb-4 block text-sm underline underline-offset-4"
                >
                  Have a promo code or gift card?
                </button>
              ) : (
                <div className="mb-4 space-y-3 rounded-md border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Promo code</span>
                      <input
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setQuote(null); }}
                        className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm uppercase"
                        autoComplete="off"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Gift card code</span>
                      <input
                        value={giftCardCode}
                        onChange={(e) => { setGiftCardCode(e.target.value.toUpperCase()); setQuote(null); }}
                        className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm uppercase"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCodes}
                    disabled={pending || (!codes.promoCode && !codes.giftCardCode)}
                  >
                    Apply
                  </Button>
                  {quote && (
                    <dl className="space-y-1 border-t pt-3 text-sm">
                      <div className="flex justify-between">
                        <dt>Class</dt>
                        <dd>{formatPrice(quote.listPriceCents)}</dd>
                      </div>
                      {quote.discount && (
                        <div className="flex justify-between text-green-700">
                          <dt>{quote.discount.code}</dt>
                          <dd>−{formatPrice(quote.discount.amountCents)}</dd>
                        </div>
                      )}
                      {quote.giftCard && (
                        <div className="flex justify-between text-green-700">
                          <dt>Gift card ({formatPrice(quote.giftCard.remainingAfterCents)} left after)</dt>
                          <dd>−{formatPrice(quote.giftCard.appliedCents)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <dt>To pay</dt>
                        <dd>{formatPrice(quote.totalCents)}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              )}
              <Button onClick={handleDropIn} disabled={pending} size="lg">
                {pending
                  ? "Working…"
                  : quote && quote.totalCents === 0
                    ? "Book now — nothing to pay"
                    : `Pay and Book — ${formatPrice(quote ? quote.totalCents : dropInPriceCents)}`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
