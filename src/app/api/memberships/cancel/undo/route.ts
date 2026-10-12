import { NextResponse } from "next/server";
import { withdrawCancel } from "@/lib/membershipFreeze";
import { actionError, currentMembership } from "../../_lib";

/** Keeps a membership that was set to cancel. */
export async function POST() {
  const found = await currentMembership();
  if ("error" in found) return found.error;
  try {
    await withdrawCancel(found.membership.id, { by: "customer" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return actionError(err);
  }
}
