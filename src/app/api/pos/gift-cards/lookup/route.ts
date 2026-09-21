import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { formatGiftCardCode } from "@/lib/giftCardCode";
import { findGiftCardByCode } from "@/lib/pos";

export const dynamic = "force-dynamic";

/**
 * A gift card's balance, so the register can show it before anything is
 * redeemed. `?code=` is matched the same forgiving way the tender route does
 * (dashes, spaces and case don't matter). Read-only.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  // Same lookup the tender route uses, so the balance shown is the card charged.
  const card = await findGiftCardByCode(code);
  if (!card) {
    return NextResponse.json(
      { error: "GIFT_CARD_NOT_FOUND", message: "No gift card with that code. Check the code and try again." },
      { status: 404 },
    );
  }

  const expired = !!card.expiresAt && card.expiresAt < new Date();
  const usable = card.isActive && !expired && card.balanceCents > 0;
  return NextResponse.json({
    id: card.id,
    code: formatGiftCardCode(card.code),
    balanceCents: card.balanceCents,
    initialCents: card.initialCents,
    isActive: card.isActive,
    expiresAt: card.expiresAt,
    usable,
    // Why it can't be used, in words for the customer conversation.
    reason: usable
      ? null
      : !card.isActive
        ? "This gift card is inactive."
        : expired
          ? "This gift card has expired."
          : "This gift card has no remaining balance.",
  });
}
