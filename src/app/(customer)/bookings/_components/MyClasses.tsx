'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { cn } from '@/lib/utils';
import { SessionCard, CardLink } from '@/components/site/SessionCard';
import { CalendarIcon, CheckIcon, PinIcon } from '@/components/site/icons';

export type ClassRow = {
  id: string;
  status: 'CONFIRMED' | 'WAITLIST' | 'CANCELLED' | 'NO_SHOW';
  kicker: string;
  title: string;
  when: string;
  day: string;
  address: string | null;
  mapHref: string | null;
  blurb: string | null;
  photo: React.ReactNode;
};

type Tab = 'upcoming' | 'past' | 'cancelled';

export function MyClasses({
  upcoming,
  past,
  cancelled,
}: {
  upcoming: ClassRow[];
  past: ClassRow[];
  cancelled: ClassRow[];
}) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ];
  const rows = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled;

  return (
    <div>
      {/* Segmented tabs, as drawn: a grey pill with the active segment in white. */}
      <div role="tablist" className="bg-fill mt-5 flex rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 rounded-full py-2 text-[13px] leading-5 font-bold transition-colors',
              tab === t.key ? 'text-headline bg-white shadow-sm' : 'text-body',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {rows.length === 0 && (
          <p className="t-body-sm text-body">
            {tab === 'upcoming' ? (
              <>
                Nothing booked yet.{' '}
                <NextLink
                  href="/book"
                  className="t-body-sm-bold text-headline underline underline-offset-4"
                >
                  Choose a class
                </NextLink>
              </>
            ) : tab === 'past' ? (
              'No past classes yet.'
            ) : (
              'No cancelled classes.'
            )}
          </p>
        )}

        {tab === 'upcoming'
          ? rows.map((r) => (
              <SessionCard
                key={r.id}
                href={`/bookings/${r.id}`}
                photo={r.photo}
                kicker={r.kicker}
                title={r.title}
                when={r.when}
                address={r.address}
                mapHref={r.mapHref}
                blurb={r.blurb}
                action={
                  <CardLink href={`/api/bookings/${r.id}/calendar`} variant="secondary" download>
                    Add to calendar
                  </CardLink>
                }
              />
            ))
          : rows.map((r) => (
              <NextLink
                key={r.id}
                href={`/bookings/${r.id}`}
                className="border-fill block rounded-2xl border bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="t-body-sm-bold text-headline">{r.day}</p>
                  {r.status === 'CANCELLED' ? (
                    <span className="text-[13px] leading-5 font-bold text-[#ff2d55]">
                      Cancelled
                    </span>
                  ) : r.status === 'NO_SHOW' ? (
                    <span className="text-body text-[13px] leading-5 font-bold">Missed</span>
                  ) : (
                    <span className="text-sage flex items-center gap-1 text-[13px] leading-5 font-bold">
                      <CheckIcon className="size-3.5" />
                      Attended
                    </span>
                  )}
                </div>
                <p className="text-body mt-0.5 text-[14px] leading-5">
                  {r.kicker} · {r.title}
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-body flex items-center gap-2 text-[14px] leading-5">
                    <CalendarIcon className="text-headline size-4 shrink-0" />
                    {r.when}
                  </p>
                  {r.address && (
                    <p className="text-body flex items-center gap-2 text-[14px] leading-5">
                      <PinIcon className="text-headline size-4 shrink-0" />
                      <span className="underline underline-offset-4">{r.address}</span>
                    </p>
                  )}
                </div>
              </NextLink>
            ))}
      </div>
    </div>
  );
}
