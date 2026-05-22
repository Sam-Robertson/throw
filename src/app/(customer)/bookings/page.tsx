"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMountainTime } from "@/lib/timezone";

type Tab = "upcoming" | "past" | "cancelled";

type BookingStatus = "CONFIRMED" | "WAITLIST" | "CANCELLED" | "NO_SHOW";
type BookingSource = "MEMBERSHIP_CREDIT" | "MEMBER_FREE" | "DROP_IN" | "COMP";

interface Booking {
  id: string;
  status: BookingStatus;
  source: BookingSource;
  amountPaidCents: number;
  studioSession: {
    startsAt: string;
    endsAt: string;
    sessionType: { name: string };
    location: { name: string } | null;
  };
}

const STATUS_VARIANT: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  WAITLIST: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "secondary",
};

const SOURCE_LABEL: Record<BookingSource, string> = {
  MEMBERSHIP_CREDIT: "Member",
  MEMBER_FREE: "Member",
  DROP_IN: "Drop-in",
  COMP: "Comp",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const limit = 20;

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status: tab,
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`/api/bookings?${params}`);
    if (res.ok) {
      const data = await res.json() as { bookings: Booking[]; total: number };
      setBookings(data.bookings);
      setTotal(data.total);
    }
    setLoading(false);
  }, [tab, page]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  function handleTabChange(t: Tab) {
    setTab(t);
    setPage(1);
  }

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({})) as {
      error?: string;
      refundNote?: string;
    };
    if (res.ok) {
      if (data.refundNote) alert(data.refundNote);
      await loadBookings();
    } else {
      alert(data.error ?? "Could not cancel booking");
    }
    setCancellingId(null);
  }

  const totalPages = Math.ceil(total / limit);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">My Bookings</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b">
          {(["upcoming", "past", "cancelled"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings found.</p>
        ) : (
          <>
            <div className="divide-y rounded-lg border">
              {bookings.map((b) => {
                const startsAt = new Date(b.studioSession.startsAt);
                const canCancel =
                  tab === "upcoming" && startsAt > twoHoursFromNow;

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {b.studioSession.sessionType.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatMountainTime(startsAt, "datetime")}
                        {b.studioSession.location &&
                          ` · ${b.studioSession.location.name}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABEL[b.source]}
                      </Badge>
                      {b.source === "DROP_IN" && b.amountPaidCents > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatCents(b.amountPaidCents)}
                        </span>
                      )}
                      <Badge
                        variant={STATUS_VARIANT[b.status]}
                        className="text-xs"
                      >
                        {b.status}
                      </Badge>
                      {tab === "past" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled
                              className="text-xs"
                            >
                              Leave a tip
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Coming soon</TooltipContent>
                        </Tooltip>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          {cancellingId === b.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  {total} booking{total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </TooltipProvider>
  );
}
