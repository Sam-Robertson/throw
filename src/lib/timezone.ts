import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const STUDIO_TIMEZONE = "America/Denver";

export function toMountainTime(date: Date): Date {
  return toZonedTime(date, STUDIO_TIMEZONE);
}

export function fromMountainTime(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, STUDIO_TIMEZONE);
}

export function formatMountainTime(
  date: Date,
  fmt: "date" | "time" | "datetime",
): string {
  const pattern =
    fmt === "date"
      ? "MMM d, yyyy"
      : fmt === "time"
        ? "h:mm a"
        : "MMM d, yyyy h:mm a";
  return formatInTimeZone(date, STUDIO_TIMEZONE, pattern);
}
