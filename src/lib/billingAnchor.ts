import { addMonths, setDate, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { STUDIO_TIMEZONE } from "@/lib/timezone";

/**
 * The next time `day` of the month comes round, at midnight America/Denver,
 * strictly after `after` (default now). Plans with billingAnchorDay bill on
 * that day; Stripe wants the anchor in the future.
 */
export function nextBillingAnchor(day: number, after: Date = new Date()): Date {
  const afterMT = toZonedTime(after, STUDIO_TIMEZONE);
  let candidateMT = setDate(startOfDay(afterMT), day);
  if (candidateMT <= afterMT) {
    candidateMT = setDate(startOfDay(addMonths(afterMT, 1)), day);
  }
  return fromZonedTime(candidateMT, STUDIO_TIMEZONE);
}

export function nextBillingAnchorUnix(day: number, after: Date = new Date()): number {
  return Math.floor(nextBillingAnchor(day, after).getTime() / 1000);
}
