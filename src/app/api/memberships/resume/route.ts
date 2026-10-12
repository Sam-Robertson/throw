import { NextResponse } from "next/server";
import { resumeMembership } from "@/lib/membershipFreeze";
import { actionError, currentMembership } from "../_lib";

/** Restarts a paused membership, or withdraws a pause that hasn't started yet. */
export async function POST() {
  const found = await currentMembership();
  if ("error" in found) return found.error;
  try {
    await resumeMembership(found.membership.id, { by: "customer" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return actionError(err);
  }
}
