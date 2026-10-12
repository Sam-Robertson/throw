import { NextResponse } from "next/server";
import { requestCancel } from "@/lib/membershipFreeze";
import { isCancelReason } from "@/lib/membershipLifecycle";
import { actionError, currentMembership } from "../_lib";

/**
 * Cancels the signed-in member's membership at a period end: by the 15th it
 * ends with this period, after the 15th one more period is billed first. The
 * reason comes from the "Why are you cancelling?" page.
 */
export async function POST(request: Request) {
  const found = await currentMembership();
  if ("error" in found) return found.error;

  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  if (!isCancelReason(body.reason))
    return NextResponse.json({ error: "Please pick a reason" }, { status: 400 });

  try {
    const result = await requestCancel(found.membership.id, { by: "customer", reason: body.reason });
    return NextResponse.json({ endsAt: result.endsAt, forfeitedCents: result.forfeitedCents });
  } catch (err) {
    return actionError(err);
  }
}
