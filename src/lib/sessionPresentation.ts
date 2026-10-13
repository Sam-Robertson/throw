import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import type { Photo } from '@/content/site';

/**
 * How a studio session is described on the customer pages ("Membership
 * Portal" design): a kicker above the title, "Tue, July 24 at 8-10pm", the
 * studio's street address, and a stock photo by kind of class, since sessions
 * carry no photo of their own.
 */

export function sessionKicker(sessionType: { membersOnly: boolean; kind: string }): string {
  if (sessionType.membersOnly) return 'Member workshop';
  if (sessionType.kind === 'COURSE') return 'Course';
  return 'Drop in class';
}

export function sessionPhoto(sessionType: { membersOnly: boolean; kind: string }): Photo {
  if (sessionType.membersOnly)
    return { src: '/site/review-2.jpg', alt: 'Hands shaping clay on the wheel' };
  if (sessionType.kind === 'COURSE')
    return { src: '/site/hero-kickstarter.jpg', alt: 'Trimming a bowl on the wheel' };
  return { src: '/site/hero-drop-in-2.jpg', alt: 'Two people throwing a pot together' };
}

function clockTime(d: Date): string {
  // "8pm", "8:30pm"
  const minutes = formatInTimeZone(d, STUDIO_TIMEZONE, 'mm');
  return formatInTimeZone(d, STUDIO_TIMEZONE, minutes === '00' ? 'haaa' : 'h:mmaaa');
}

/** "Tue, July 24 at 8-10pm" (the end time's meridiem is dropped when both match). */
export function sessionWhen(startsAt: Date, endsAt: Date): string {
  const day = formatInTimeZone(startsAt, STUDIO_TIMEZONE, 'EEE, MMMM d');
  const start = clockTime(startsAt);
  const end = clockTime(endsAt);
  const sameMeridiem = start.slice(-2) === end.slice(-2);
  const range = sameMeridiem ? `${start.slice(0, -2)}-${end}` : `${start}-${end}`;
  return `${day} at ${range}`;
}

/** "Tues July 24th" for the compact past/cancelled rows. */
export function sessionDayLabel(startsAt: Date): string {
  return formatInTimeZone(startsAt, STUDIO_TIMEZONE, 'EEE MMMM do');
}

export function mapHref(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}
