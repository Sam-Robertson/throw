import { Prisma } from "@prisma/client";

/**
 * Parses the plan form body shared by POST and PATCH. Only the fields listed
 * here can be written: `stripePriceId` is deliberately absent — it is managed
 * by ensureStripePriceForPlan (src/lib/stripePrices.ts), never typed by hand.
 */

export const PLAN_TIERS = ["BASIC", "PRO", "EXPERT", "STUDENT"] as const;
export const SHELF_TYPES = ["HALF", "FULL"] as const;

type Body = Record<string, unknown>;
// Create-input field types are plain values, so the same object is valid for
// both prisma create and update.
export type PlanInput = Partial<
  Omit<Prisma.MembershipPlanUncheckedCreateInput, "id" | "stripePriceId" | "memberships">
>;

export class PlanInputError extends Error {}

function has(body: Body, key: string): boolean {
  return body[key] !== undefined;
}

function wholeNumber(body: Body, key: string, min: number): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min)
    throw new PlanInputError(`${key} must be a whole number of at least ${min}`);
  return value;
}

function wholeNumberOrNull(body: Body, key: string, min: number): number | null {
  return body[key] === null ? null : wholeNumber(body, key, min);
}

function text(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "")
    throw new PlanInputError(`${key} is required`);
  return value.trim();
}

function textOrNull(body: Body, key: string): string | null {
  const value = body[key];
  if (value === null || value === "") return null;
  return text(body, key);
}

function oneOfOrNull<T extends string>(body: Body, key: string, allowed: readonly T[]): T | null {
  const value = textOrNull(body, key);
  if (value === null) return null;
  if (!allowed.includes(value as T))
    throw new PlanInputError(`${key} must be one of ${allowed.join(", ")}`);
  return value as T;
}

function flag(body: Body, key: string): boolean {
  if (typeof body[key] !== "boolean") throw new PlanInputError(`${key} must be true or false`);
  return body[key] as boolean;
}

// Perks are the bullet points on the public plan card: a list of short strings.
function perkList(body: Body): string[] | typeof Prisma.DbNull {
  const value = body.perks;
  if (value === null) return Prisma.DbNull;
  if (!Array.isArray(value) || value.some((perk) => typeof perk !== "string"))
    throw new PlanInputError("perks must be a list of text lines");
  const perks = (value as string[]).map((perk) => perk.trim()).filter(Boolean);
  return perks.length > 0 ? perks : Prisma.DbNull;
}

/** Returns only the fields present in `body`, validated. Throws PlanInputError. */
export function parsePlanInput(body: Body): PlanInput {
  const data: PlanInput = {};

  if (has(body, "name")) data.name = text(body, "name");
  if (has(body, "slug")) data.slug = text(body, "slug");
  if (has(body, "description")) data.description = textOrNull(body, "description");
  if (has(body, "priceInCents")) data.price = wholeNumber(body, "priceInCents", 0);
  if (has(body, "billingIntervalDays"))
    data.billingIntervalDays = wholeNumber(body, "billingIntervalDays", 1);
  if (has(body, "locationId")) data.locationId = textOrNull(body, "locationId");

  if (has(body, "classTicketsPerPeriod"))
    data.classTicketsPerPeriod = wholeNumberOrNull(body, "classTicketsPerPeriod", 0);
  if (has(body, "ticketRolloverEnabled"))
    data.ticketRolloverEnabled = flag(body, "ticketRolloverEnabled");
  if (has(body, "ticketRolloverMaxTickets"))
    data.ticketRolloverMaxTickets = wholeNumberOrNull(body, "ticketRolloverMaxTickets", 0);

  if (has(body, "shelfType")) {
    data.shelfType = oneOfOrNull(body, "shelfType", SHELF_TYPES);
    data.hasShelfSpace = data.shelfType !== null;
  }
  if (has(body, "joiningFeeCents")) data.joiningFeeCents = wholeNumber(body, "joiningFeeCents", 0);
  if (has(body, "perks")) data.perks = perkList(body);

  if (has(body, "tier")) data.tier = oneOfOrNull(body, "tier", PLAN_TIERS);
  if (has(body, "isPublic")) data.isPublic = flag(body, "isPublic");
  if (has(body, "isLegacy")) data.isLegacy = flag(body, "isLegacy");
  if (has(body, "isFounding")) data.isFounding = flag(body, "isFounding");
  if (has(body, "capGroupId")) data.capGroupId = textOrNull(body, "capGroupId");
  if (has(body, "forfeitsRateOnCancelOrFreeze"))
    data.forfeitsRateOnCancelOrFreeze = flag(body, "forfeitsRateOnCancelOrFreeze");
  if (has(body, "priceNeedsConfirmation"))
    data.priceNeedsConfirmation = flag(body, "priceNeedsConfirmation");

  return data;
}
