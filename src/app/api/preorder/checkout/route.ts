import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Public, unauthenticated endpoint — called cross-origin from the Squarespace-hosted
// Lehi preorder widget (squarespace/lehi-preorder.html), which never holds a Stripe key.
// It only ever creates a Checkout Session for a price ID the widget already chose from
// CONFIG; it does not trust or persist anything beyond what Stripe stores as metadata.
// Everything sold through this widget (classes, courses) is a one-time payment —
// there's no subscription/membership path anymore.

// The widget is live at this exact Squarespace origin, so CORS is locked to it.
const ALLOWED_ORIGIN = "https://www.throwartstudio.com";

// Redirect targets live here, not in the request body — the widget never sends
// them. If a client could supply success_url/cancel_url, anyone could POST here
// directly (this route is public and unauthenticated) and mint a real Stripe
// Checkout session that redirects wherever they want after payment.
// Success sends the customer back to the preorder page itself (with a
// ?status=success flag the widget reads to show a confirmation before it
// forwards them to the homepage) rather than straight to the homepage, so
// there's a moment to confirm the booking actually went through.
const SUCCESS_URL = "https://www.throwartstudio.com/lehipreorder?status=success";
const CANCEL_URL = "https://www.throwartstudio.com/";

const MAX_QUANTITY = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface PreorderCheckoutBody {
  offering?: string;
  offeringTitle?: string;
  priceId?: string;
  quantity?: number;
  amount?: number;
  selectionLabel?: string;
  selectionDetail?: string;
  name?: string;
  email?: string;
  birthday?: string;
  phone?: string;
  smsBooking?: boolean;
  smsOffers?: boolean;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  let body: PreorderCheckoutBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const {
    offering,
    offeringTitle,
    priceId,
    quantity,
    selectionLabel,
    selectionDetail,
    name,
    email,
    birthday,
    phone,
    smsBooking,
    smsOffers,
  } = body;

  if (!priceId || priceId.startsWith("price_TODO")) {
    return json({ error: "This offering isn't configured for payments yet" }, 400);
  }
  const qty = Number.isInteger(quantity) && (quantity as number) > 0 ? (quantity as number) : 1;
  if (qty > MAX_QUANTITY) {
    return json({ error: "Quantity too high" }, 400);
  }
  if (!email || !isValidEmail(email)) {
    return json({ error: "A valid email is required" }, 400);
  }
  if (!name || !phone) {
    return json({ error: "Name and phone are required" }, 400);
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: qty }],
      customer_email: email,
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      metadata: {
        offering: offering ?? "",
        offeringTitle: offeringTitle ?? "",
        selectionLabel: selectionLabel ?? "",
        selectionDetail: selectionDetail ?? "",
        quantity: String(qty),
        name,
        birthday: birthday ?? "",
        phone,
        smsBooking: smsBooking ? "true" : "false",
        smsOffers: smsOffers ? "true" : "false",
        source: "lehi-preorder-widget",
      },
    });

    if (!checkoutSession.url) {
      return json({ error: "Stripe did not return a checkout URL" }, 502);
    }

    return json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating checkout session";
    return json({ error: message }, 500);
  }
}
