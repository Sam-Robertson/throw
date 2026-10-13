'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/site/BottomSheet';
import { CalendarIcon, PinIcon } from '@/components/site/icons';

/**
 * "Can't make it? Cancel this booking" → the "Are you sure?" sheet from the
 * design: the class in a card, a note that the ticket comes straight back,
 * a red "Cancel my booking" button and "Keep my spot".
 */
export function CancelBooking({
  bookingId,
  usedTicket,
  summary,
}: {
  bookingId: string;
  usedTicket: boolean;
  summary: { kicker: string; title: string; when: string; address: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Could not cancel this booking. Please try again.');
    }
    setBusy(false);
  }

  return (
    <>
      <p className="text-body mt-4 text-center text-[14px] leading-5">
        Can’t make it?{' '}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="t-body-sm-bold text-headline underline underline-offset-4"
        >
          Cancel this booking
        </button>
      </p>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Are you sure?">
        <div className="border-fill rounded-2xl border px-4 py-4">
          <p className="t-body-sm-bold text-headline">{summary.title}</p>
          <p className="text-body text-[14px] leading-5">{summary.kicker}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-body flex items-center gap-2 text-[14px] leading-5">
              <CalendarIcon className="text-headline size-4 shrink-0" />
              {summary.when}
            </p>
            {summary.address && (
              <p className="text-body flex items-center gap-2 text-[14px] leading-5">
                <PinIcon className="text-headline size-4 shrink-0" />
                {summary.address}
              </p>
            )}
          </div>
        </div>

        <p className="text-body mt-4 text-[14px] leading-5">
          {usedTicket
            ? 'Your class ticket goes straight back to your account. It works on any upcoming class.'
            : 'Your spot opens up for another member.'}
        </p>

        {error && <p className="mt-3 text-[14px] leading-5 text-[#ff2d55]">{error}</p>}

        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#ff2d55] text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Cancelling…' : 'Cancel my booking'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-body-sm-bold text-headline mt-4 block w-full text-center"
        >
          Keep my spot
        </button>
      </BottomSheet>
    </>
  );
}
