'use client';

import { useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import {
  formatMoney,
  type CourseCatalogItem,
  type PosCatalog,
  type PosOrder,
  type UpcomingSessionCatalogItem,
} from '../types';

function dayKey(date: Date | string): string {
  return formatInTimeZone(date, STUDIO_TIMEZONE, 'yyyy-MM-dd');
}

function time(date: string): string {
  return formatInTimeZone(date, STUDIO_TIMEZONE, 'h:mm a');
}

/** Every session the order's class lines already book (a course line books several). */
function sessionIdsOnOrder(order: PosOrder | null): Set<string> {
  const ids = new Set<string>();
  for (const item of order?.items ?? []) {
    if (item.itemType !== 'DROP_IN') continue;
    const m = item.metadata;
    if (typeof m !== 'object' || m === null || Array.isArray(m)) continue;
    const meta = m as Record<string, unknown>;
    if (typeof meta.studioSessionId === 'string') ids.add(meta.studioSessionId);
    if (Array.isArray(meta.courseSessionIds)) {
      for (const id of meta.courseSessionIds) if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

interface ClassesTabProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  onAddDropIn: (studioSessionId: string) => void;
  onAddCourse: (course: CourseCatalogItem) => void;
}

export function ClassesTab({ catalog, order, busy, onAddDropIn, onAddCourse }: ClassesTabProps) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const onOrder = useMemo(() => sessionIdsOnOrder(order), [order]);

  // Single classes, today first then day by day. Courses are sold whole, so
  // their sessions are left to the Courses group. Finished sessions drop off.
  const days = useMemo(() => {
    const now = Date.now();
    const today = dayKey(new Date());
    const groups = new Map<string, UpcomingSessionCatalogItem[]>();
    for (const s of catalog?.upcomingSessions ?? []) {
      if (s.kind === 'COURSE' || new Date(s.endsAt).getTime() <= now) continue;
      if (q && !`${s.name} ${s.instructorName ?? ''}`.toLowerCase().includes(q)) continue;
      const key = dayKey(s.startsAt);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, sessions]) => ({
        key,
        label:
          key === today
            ? `Today, ${formatInTimeZone(sessions[0].startsAt, STUDIO_TIMEZONE, 'EEE MMM d')}`
            : formatInTimeZone(sessions[0].startsAt, STUDIO_TIMEZONE, 'EEEE, MMM d'),
        isToday: key === today,
        sessions,
      }));
  }, [catalog, q]);

  const courses = useMemo(
    () =>
      (catalog?.courses ?? []).filter(
        (c) => !q || `${c.name} ${c.instructorName ?? ''}`.toLowerCase().includes(q),
      ),
    [catalog, q],
  );

  const sessionBlocked = (s: UpcomingSessionCatalogItem) => s.capacity - s.confirmedCount <= 0 || onOrder.has(s.id);
  const courseBlocked = (c: CourseCatalogItem) => c.spotsLeft <= 0 || c.sessions.some((s) => onOrder.has(s.id));

  // Enter adds the first thing on screen that can be added.
  function addTopResult() {
    if (!q || busy || !order) return;
    const todayGroup = days.filter((d) => d.isToday);
    const laterDays = days.filter((d) => !d.isToday);
    const firstToday = todayGroup.flatMap((d) => d.sessions).find((s) => !sessionBlocked(s));
    if (firstToday) return onAddDropIn(firstToday.id);
    const firstCourse = courses.find((c) => !courseBlocked(c));
    if (firstCourse) return onAddCourse(firstCourse);
    const firstLater = laterDays.flatMap((d) => d.sessions).find((s) => !sessionBlocked(s));
    if (firstLater) onAddDropIn(firstLater.id);
  }

  function renderDay(day: (typeof days)[number]) {
    return (
      <section key={day.key} className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{day.label}</h3>
        <div className="divide-y rounded-lg border">
          {day.sessions.map((s) => {
            const seatsLeft = Math.max(0, s.capacity - s.confirmedCount);
            const full = seatsLeft === 0;
            const inCart = onOrder.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy || !order || full || inCart}
                onClick={() => onAddDropIn(s.id)}
                className={cn(
                  'flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left',
                  full || inCart ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted active:bg-muted',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {time(s.startsAt)} · {s.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.instructorName ? `${s.instructorName} · ` : ''}
                    {inCart ? 'In this order' : full ? 'Full' : `${seatsLeft} of ${s.capacity} spots left`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatMoney(s.dropInPriceCents)}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const nothingListed = days.length === 0 && courses.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        onEnter={addTopResult}
        placeholder="Search classes and courses…"
      />

      {nothingListed && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          {q
            ? 'No classes or courses match.'
            : 'No classes for sale at this studio today or in the next 7 days.'}
        </p>
      )}

      {days.filter((d) => d.isToday).map(renderDay)}

      {/* Courses: one entry per course, sold once for every remaining session */}
      {courses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Courses</h3>
          <div className="divide-y rounded-lg border">
            {courses.map((c) => {
              const full = c.spotsLeft <= 0;
              const inCart = c.sessions.some((s) => onOrder.has(s.id));
              const held = c.totalSessions - c.sessions.length;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={busy || !order || full || inCart}
                  onClick={() => onAddCourse(c)}
                  className={cn(
                    'flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left',
                    full || inCart ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted active:bg-muted',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.started ? 'Started' : 'Starts'}{' '}
                      {formatInTimeZone(c.startsAt, STUDIO_TIMEZONE, 'EEE MMM d')}, {time(c.sessions[0].startsAt)}
                      {c.instructorName ? ` · ${c.instructorName}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c.sessions.length} session{c.sessions.length === 1 ? '' : 's'}
                      {held > 0 ? ` left of ${c.totalSessions}` : ''}:{' '}
                      {c.sessions.map((s) => formatInTimeZone(s.startsAt, STUDIO_TIMEZONE, 'MMM d')).join(', ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {inCart
                        ? 'In this order'
                        : full
                          ? 'Full'
                          : `${c.spotsLeft} spot${c.spotsLeft === 1 ? '' : 's'} left`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold">{formatMoney(c.priceCents)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {days.filter((d) => !d.isToday).map(renderDay)}

      <p className="text-xs text-muted-foreground">
        A class sale books a seat for the customer on this order (a course books every session listed), so
        attach the customer before charging. For a walk-in, use New customer in the order panel.
      </p>
    </div>
  );
}
