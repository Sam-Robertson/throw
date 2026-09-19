import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Small body-parsing helpers shared by the membership catalog routes
 * (commitment terms, add-ons, cap groups, freeze policy).
 */

export type Body = Record<string, unknown>;

export class InputError extends Error {}

export function has(body: Body, key: string): boolean {
  return body[key] !== undefined;
}

export function wholeNumber(body: Body, key: string, min = 0, max?: number): number {
  const value = body[key];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    (max !== undefined && value > max)
  )
    throw new InputError(
      max === undefined
        ? `${key} must be a whole number of at least ${min}`
        : `${key} must be a whole number from ${min} to ${max}`,
    );
  return value;
}

export function wholeNumberOrNull(body: Body, key: string, min = 0): number | null {
  return body[key] === null ? null : wholeNumber(body, key, min);
}

export function text(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") throw new InputError(`${key} is required`);
  return value.trim();
}

export function textOrNull(body: Body, key: string): string | null {
  const value = body[key];
  if (value === null || value === "") return null;
  return text(body, key);
}

export function flag(body: Body, key: string): boolean {
  if (typeof body[key] !== "boolean") throw new InputError(`${key} must be true or false`);
  return body[key] as boolean;
}

export function inputErrorResponse(err: unknown): NextResponse {
  if (err instanceof InputError) return NextResponse.json({ error: err.message }, { status: 400 });
  throw err;
}

/**
 * Rows with no studio (commitment terms, an add-on sold at every studio)
 * apply to the whole business, so only an ADMIN may change them.
 */
export function adminOnlyResponse(session: Session): NextResponse | null {
  if (session.user.role === "ADMIN") return null;
  return NextResponse.json(
    { error: "Only an admin can change settings that apply to every studio" },
    { status: 403 },
  );
}
