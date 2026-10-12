// Pure rules for pausing and cancelling a membership, and the small text
// helpers the account page needs. No prisma, no Stripe, so client components
// and unit tests can import this freely. The server side that talks to Stripe
// lives in src/lib/membershipFreeze.ts.
//
// Source: the "My membership" and "My account" design files (Oct 2026):
//   - Pausing costs $5 a month, every dollar comes back as store credit plus
//     $2 extra ($7 a month), and normal billing resumes after 3 months.
//   - Only someone who has been a member for at least one full month can pause.
//   - A pause requested by 11:59 PM Mountain time on the last day of the month
//     starts with the next billing period; otherwise one more regular month
//     is paid first. Both fall out of "the pause starts at the current period
//     end", because membership billing is anchored on the 1st.
//   - Cancel by the 15th and the membership ends with this period; after the
//     15th one more period is billed and the membership ends after that.

import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { billingIntervalFromDays } from "@/lib/billingInterval";
import { STUDIO_TIMEZONE } from "@/lib/timezone";

/** What a freeze costs and earns when the studio has not set its own policy. */
export const FREEZE_DEFAULTS = { monthlyFeeCents: 500, creditCentsPerFrozenMonth: 700 } as const;

/** Billing goes back to normal on its own after this many paused months. */
export const FREEZE_MONTHS = 3;

/** A membership can be paused once it is this old. */
export const MIN_TENURE_MONTHS = 1;

/** Cancel on or before this day of the month (Mountain time) to end with the current period. */
export const CANCEL_CUTOFF_DAY = 15;

export interface FreezeTerms {
  monthlyFeeCents: number;
  creditCentsPerFrozenMonth: number;
}

/** The studio's freeze policy with the design's figures filling any blanks. */
export function freezeTerms(
  policy: { monthlyFeeCents: number | null; creditCentsPerFrozenMonth: number | null } | null | undefined,
): FreezeTerms {
  return {
    monthlyFeeCents: policy?.monthlyFeeCents ?? FREEZE_DEFAULTS.monthlyFeeCents,
    creditCentsPerFrozenMonth:
      policy?.creditCentsPerFrozenMonth ?? FREEZE_DEFAULTS.creditCentsPerFrozenMonth,
  };
}

/** "Anyone who's been with us at least one full month." */
export function canPause(createdAt: Date, now: Date = new Date()): boolean {
  return addInMountainTime(createdAt, (d) => addMonths(d, MIN_TENURE_MONTHS)) <= now;
}

/**
 * Calendar arithmetic in the studio's timezone, so "three months after
 * midnight Nov 1" is midnight Feb 1 in Denver whatever the server's clock is
 * set to (and whichever side of a daylight-saving change the dates fall).
 * These are estimates for display and for the webhook's date checks; the
 * billing dates themselves come from Stripe.
 */
function addInMountainTime(date: Date, add: (zoned: Date) => Date): Date {
  return fromZonedTime(add(toZonedTime(date, STUDIO_TIMEZONE)), STUDIO_TIMEZONE);
}

/** When a pause requested now takes effect and when billing resumes on its own. */
export function pauseWindow(currentPeriodEnd: Date): { pausedAt: Date; resumesAt: Date } {
  return {
    pausedAt: currentPeriodEnd,
    resumesAt: addInMountainTime(currentPeriodEnd, (d) => addMonths(d, FREEZE_MONTHS)),
  };
}

/** The day of the month in the studio's timezone. */
export function mountainDayOfMonth(date: Date): number {
  return toZonedTime(date, STUDIO_TIMEZONE).getDate();
}

/** One billing interval after `date`. */
export function addBillingInterval(date: Date, billingIntervalDays: number): Date {
  const { unit, count } = billingIntervalFromDays(billingIntervalDays);
  switch (unit) {
    case "year":
      return addInMountainTime(date, (d) => addYears(d, count));
    case "month":
      return addInMountainTime(date, (d) => addMonths(d, count));
    case "week":
      return addInMountainTime(date, (d) => addWeeks(d, count));
    default:
      return addInMountainTime(date, (d) => addDays(d, count));
  }
}

/**
 * When a cancellation requested at `now` ends the membership: with the current
 * period on or before the 15th, one period later after that.
 */
export function cancelEndsAt({
  now,
  currentPeriodEnd,
  billingIntervalDays,
}: {
  now: Date;
  currentPeriodEnd: Date;
  billingIntervalDays: number;
}): Date {
  if (mountainDayOfMonth(now) <= CANCEL_CUTOFF_DAY) return currentPeriodEnd;
  return addBillingInterval(currentPeriodEnd, billingIntervalDays);
}

/** The reasons offered on the "Why are you cancelling?" page, in that order. */
export const CANCEL_REASONS = [
  { id: "too-expensive", label: "It’s too expensive" },
  { id: "too-busy", label: "I’m too busy" },
  { id: "wheel-time", label: "Hard to get wheel time" },
  { id: "moving", label: "Moving or switching studios" },
  { id: "other", label: "Other" },
] as const;

export type CancelReasonId = (typeof CANCEL_REASONS)[number]["id"];

export function cancelReasonLabel(id: string | null | undefined): string | null {
  return CANCEL_REASONS.find((r) => r.id === id)?.label ?? null;
}

export function isCancelReason(id: unknown): id is CancelReasonId {
  return typeof id === "string" && CANCEL_REASONS.some((r) => r.id === id);
}

// ── Account page text helpers ────────────────────────────────────────────────

/** User.name is one string; the edit sheet shows first and last. */
export function splitName(name: string | null | undefined): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}

/** "+18013625752" shows as "801-362-5752"; anything else is shown as stored. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return phone;
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "$70" for whole dollars, "$12.50" otherwise. */
export function formatDollarsShort(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatCents(cents);
}

/** "mo", "yr", "3 mo", "4 wk". */
export function shortPeriodLabel(billingIntervalDays: number): string {
  const { unit, count } = billingIntervalFromDays(billingIntervalDays);
  const short = { month: "mo", year: "yr", week: "wk", day: "day" }[unit];
  return count === 1 ? short : `${count} ${short}`;
}

/** The shelf line on a plan card, worded as the design files have it. */
export function shelfLine(shelfType: string | null): string {
  if (shelfType === "FULL") return "48×24” shelf space";
  if (shelfType === "HALF") return "24×24” shelf space";
  return "No shelf space";
}

export function ticketsLine(classTicketsPerPeriod: number | null): string {
  return classTicketsPerPeriod === null ? "Unlimited class tickets" : `${classTicketsPerPeriod} class tickets`;
}
