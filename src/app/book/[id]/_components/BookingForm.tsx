"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string;
  hasMembership: boolean;
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
  const [error, setError] = useState<string | null>(null);

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
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ??
            "Something went wrong. Please try again.",
        );
        return;
      }
      router.push("/dashboard?booked=1");
    } catch {
      setError("Something went wrong. Please try again.");
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
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ??
            "Something went wrong. Please try again.",
        );
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

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
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {hasMembership ? (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            This session is included in your membership — no charge.
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
          <p className="mb-4 text-sm text-muted-foreground">
            Drop-in price:{" "}
            <span className="font-semibold text-foreground">
              {formatPrice(dropInPriceCents)}
            </span>
          </p>
          <Button onClick={handleDropIn} disabled={pending} size="lg">
            {pending
              ? "Redirecting to payment…"
              : spotsRemaining <= 0
                ? `Pay and Join Waitlist — ${formatPrice(dropInPriceCents)}`
                : `Pay and Book — ${formatPrice(dropInPriceCents)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
