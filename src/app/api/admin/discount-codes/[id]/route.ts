import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";

// ── PATCH — toggle active / inactive ─────────────────────────────────────
// Stripe doesn't allow deleting promo codes, only deactivating.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { active: boolean };

  try {
    const updated = await stripe.promotionCodes.update(id, { active: body.active });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
