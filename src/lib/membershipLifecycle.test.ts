import { describe, expect, it } from "vitest";
import {
  canPause,
  cancelEndsAt,
  formatPhoneDisplay,
  freezeTerms,
  isValidEmail,
  joinName,
  pauseWindow,
  shelfLine,
  shortPeriodLabel,
  splitName,
} from "./membershipLifecycle";

// Mountain time is UTC-6 in summer, UTC-7 in winter.
const sept1 = new Date("2026-09-01T06:00:00Z"); // midnight MDT on Sept 1
const oct1 = new Date("2026-10-01T06:00:00Z");
const nov1 = new Date("2026-11-01T06:00:00Z");

describe("freezeTerms", () => {
  it("uses the studio policy when it is set", () => {
    expect(freezeTerms({ monthlyFeeCents: 1000, creditCentsPerFrozenMonth: 1200 })).toEqual({
      monthlyFeeCents: 1000,
      creditCentsPerFrozenMonth: 1200,
    });
  });

  it("falls back to the design's $5 fee and $7 credit per blank", () => {
    expect(freezeTerms(null)).toEqual({ monthlyFeeCents: 500, creditCentsPerFrozenMonth: 700 });
    expect(freezeTerms({ monthlyFeeCents: 800, creditCentsPerFrozenMonth: null })).toEqual({
      monthlyFeeCents: 800,
      creditCentsPerFrozenMonth: 700,
    });
  });
});

describe("canPause", () => {
  it("needs one full month of membership", () => {
    expect(canPause(sept1, new Date("2026-09-30T12:00:00Z"))).toBe(false);
    expect(canPause(sept1, oct1)).toBe(true);
  });
});

describe("pauseWindow", () => {
  it("starts at the period end and resumes three months later", () => {
    // Midnight MST on Jan 1 is 07:00Z: the clocks changed in November.
    expect(pauseWindow(oct1)).toEqual({ pausedAt: oct1, resumesAt: new Date("2027-01-01T07:00:00Z") });
  });
});

describe("cancelEndsAt", () => {
  it("ends with the current period when cancelled by the 15th", () => {
    const now = new Date("2026-10-15T23:30:00-06:00"); // 11:30 PM MDT on the 15th
    expect(cancelEndsAt({ now, currentPeriodEnd: nov1, billingIntervalDays: 30 })).toEqual(nov1);
  });

  it("bills one more month when cancelled after the 15th", () => {
    const now = new Date("2026-10-16T00:30:00-06:00"); // 12:30 AM MDT on the 16th
    // Midnight MST on Dec 1 is 07:00Z.
    expect(cancelEndsAt({ now, currentPeriodEnd: nov1, billingIntervalDays: 30 })).toEqual(
      new Date("2026-12-01T07:00:00Z"),
    );
  });

  it("uses the studio's day of the month, not UTC's", () => {
    // 4 AM UTC on the 16th is still 10 PM on the 15th in Denver.
    const now = new Date("2026-10-16T04:00:00Z");
    expect(cancelEndsAt({ now, currentPeriodEnd: nov1, billingIntervalDays: 30 })).toEqual(nov1);
  });

  it("adds a whole year for an annual plan", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(cancelEndsAt({ now, currentPeriodEnd: nov1, billingIntervalDays: 365 })).toEqual(
      new Date("2027-11-01T06:00:00Z"),
    );
  });
});

describe("names and phones", () => {
  it("splits and joins a name around the first space", () => {
    expect(splitName("Sydney Robertson")).toEqual({ first: "Sydney", last: "Robertson" });
    expect(splitName("Mary Ann van Dyke")).toEqual({ first: "Mary", last: "Ann van Dyke" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
    expect(joinName(" Sydney ", "")).toBe("Sydney");
  });

  it("shows a stored E.164 number with dashes", () => {
    expect(formatPhoneDisplay("+18013625752")).toBe("801-362-5752");
    expect(formatPhoneDisplay("8013625752")).toBe("801-362-5752");
    expect(formatPhoneDisplay("+441234567890")).toBe("+441234567890");
    expect(formatPhoneDisplay(null)).toBe("");
  });

  it("checks an email has a domain with a dot", () => {
    expect(isValidEmail("writesydney@gmail.com")).toBe(true);
    expect(isValidEmail("writesydney@gnail")).toBe(false);
    expect(isValidEmail("not an email")).toBe(false);
  });
});

describe("plan card lines", () => {
  it("words the shelf and period as the design files do", () => {
    expect(shelfLine("HALF")).toBe("24×24” shelf space");
    expect(shelfLine("FULL")).toBe("48×24” shelf space");
    expect(shelfLine(null)).toBe("No shelf space");
    expect(shortPeriodLabel(30)).toBe("mo");
    expect(shortPeriodLabel(365)).toBe("yr");
    expect(shortPeriodLabel(90)).toBe("3 mo");
  });
});
