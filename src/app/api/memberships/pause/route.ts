import { NextResponse } from "next/server";
import { requestPause } from "@/lib/membershipFreeze";
import { sendMembershipPausedEmail } from "@/lib/email/membership";
import { actionError, currentMembership } from "../_lib";

/**
 * Pauses the signed-in member's membership from the next period end: $5 a
 * month (or the studio's freeze fee) for three months, then normal billing.
 * The body must carry `agree: true`, the terms checkbox on the pause page.
 */
export async function POST(request: Request) {
  const found = await currentMembership();
  if ("error" in found) return found.error;

  const body = (await request.json().catch(() => ({}))) as { agree?: boolean };
  if (body.agree !== true)
    return NextResponse.json({ error: "Please agree to the pause terms first" }, { status: 400 });

  try {
    const result = await requestPause(found.membership.id, { by: "customer" });
    const emailed = await sendMembershipPausedEmail({ membershipId: found.membership.id, ...result });
    return NextResponse.json({
      pausedAt: result.pausedAt,
      resumesAt: result.resumesAt,
      monthlyFeeCents: result.terms.monthlyFeeCents,
      creditCentsPerFrozenMonth: result.terms.creditCentsPerFrozenMonth,
      emailed,
    });
  } catch (err) {
    return actionError(err);
  }
}
