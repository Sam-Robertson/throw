import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";

// ── GET — list all promotion codes ────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await stripe.promotionCodes.list({
    limit: 100,
    expand: ["data.promotion.coupon"],
  });

  return NextResponse.json(codes.data);
}

// ── POST — create coupon + promotion code ─────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;   // percent 1-100  OR  cents for fixed
    expiresAt?: string;      // ISO date string (optional)
    maxRedemptions?: number;
    firstTimeOnly?: boolean;
    name?: string;
  };

  if (!body.code?.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  if (!body.discountValue || body.discountValue <= 0) {
    return NextResponse.json({ error: "Discount value must be greater than 0" }, { status: 400 });
  }

  try {
    // Step 1 — create the coupon (defines the discount logic)
    const coupon = await stripe.coupons.create({
      duration: "once",
      name: body.name?.trim() || body.code.trim().toUpperCase(),
      ...(body.discountType === "percent"
        ? { percent_off: body.discountValue }
        : { amount_off: body.discountValue, currency: "usd" }),
    });

    // Step 2 — create the human-readable promotion code (Stripe SDK v22)
    const promoCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: body.code.trim().toUpperCase(),
      expand: ["promotion.coupon"],
      ...(body.maxRedemptions ? { max_redemptions: body.maxRedemptions } : {}),
      ...(body.expiresAt
        ? { expires_at: Math.floor(new Date(body.expiresAt).getTime() / 1000) }
        : {}),
      ...(body.firstTimeOnly
        ? { restrictions: { first_time_transaction: true } }
        : {}),
    });

    return NextResponse.json(promoCode, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
