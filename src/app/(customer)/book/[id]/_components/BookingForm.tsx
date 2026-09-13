"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BookingError = { message: string; waiverVersionId?: string };

type ErrorBody = { error?: string; waiverVersionId?: string };

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
      return { message: data.error ?? "Something went wrong. Please try again." };
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
  sessionName: string;
  sessionDate: string;
  sessionTime: string;
  instructorName: string | null;
  durationMinutes: number;
  spotsRemaining: number;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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
  sessionName,
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

  async function handleDropIn() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioSessionId: sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ErrorBody;
        if (data.error === "SESSION_FULL") setSessionFull(true);
        setError(describeError(data));
        return;
      }
      const { url } = (await res.json()) as { url: string };
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
            <Button onClick={handleDropIn} disabled={pending} size="lg">
              {pending
                ? "Redirecting to payment…"
                : `Pay and Book — ${formatPrice(dropInPriceCents)}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
