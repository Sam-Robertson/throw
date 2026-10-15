import { type NextRequest, NextResponse } from 'next/server';
import { stripeForLocation } from '@/lib/stripe';
import { findStripeCustomerId } from '@/lib/stripeCustomers';
import { getFiringProducts } from '@/lib/pos';
import { quoteMemberFiring } from '@/lib/firing';
import { glazePayStudio, OVERSIZE_HEIGHT_IN } from '@/lib/glazePay';
import {
  createCustomerFromContact,
  findCustomerByContact,
  parseCustomerContact,
} from '@/lib/customerContact';

const MAX_PIECES = 20;

/**
 * POST /api/pay/checkout
 *   { name, phone, email?, textOptIn?, pieces: [{ weightLb, heightIn }] } → { url }
 *
 * The public glaze-firing page (/pay, behind the poster QR code). No sign-in:
 * the name and phone find the customer's account or make one (the same way
 * the register does), the pieces are priced with the POS rules (over 12
 * inches is the oversize rate), and a Stripe Checkout Session opens in the
 * studio's account. The webhook records the payment and the pieces
 * (checkout.session.completed, metadata.type "firing").
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    textOptIn?: unknown;
    pieces?: { weightLb?: unknown; heightIn?: unknown }[];
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const contact = parseCustomerContact({ name: body.name, email: body.email, phone: body.phone });
  if (!contact.ok) return NextResponse.json({ error: contact.message }, { status: 400 });
  if (!contact.value.phone) {
    return NextResponse.json({ error: 'A phone number is needed so we can text you.' }, { status: 400 });
  }

  const raw = Array.isArray(body.pieces) ? body.pieces : [];
  if (raw.length === 0) return NextResponse.json({ error: 'Add at least one piece.' }, { status: 400 });
  if (raw.length > MAX_PIECES) {
    return NextResponse.json({ error: `Up to ${MAX_PIECES} pieces at a time.` }, { status: 400 });
  }
  const pieces = raw.map((p) => {
    const heightIn = Number(p.heightIn);
    return {
      weightLb: Number(p.weightLb),
      heightIn: Number.isFinite(heightIn) && heightIn >= 0 ? heightIn : 0,
    };
  });

  const firing = await getFiringProducts();
  if (!firing) return NextResponse.json({ error: 'Firing payments aren’t set up yet.' }, { status: 503 });
  const quote = quoteMemberFiring(
    pieces.map((p) => ({ weightLb: p.weightLb, oversize: p.heightIn > OVERSIZE_HEIGHT_IN })),
    firing.rates,
  );
  if (!quote.ok) return NextResponse.json({ error: quote.reason }, { status: 400 });

  const studio = await glazePayStudio();
  if (!studio) return NextResponse.json({ error: 'No studio is set up for firing.' }, { status: 503 });

  const customer = (await findCustomerByContact(contact.value)) ?? (await createCustomerFromContact(contact.value));

  const account = await stripeForLocation(studio.id);
  const stripeCustomerId = await findStripeCustomerId(account, customer.id);
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Stripe metadata values are capped at 500 characters; 20 pieces fit.
  const piecesMeta = quote.lines
    .map((l) => `${l.weightLb}:${l.oversize ? 1 : 0}:${l.chargeCents}`)
    .join(',');

  const checkout = await account.client.checkout.sessions.create({
    mode: 'payment',
    line_items: quote.lines.map((l, i) => ({
      price_data: {
        currency: 'usd',
        unit_amount: l.chargeCents,
        product_data: {
          name: `Glaze firing, ${l.weightLb.toFixed(1)} lb piece, ${pieces[i].heightIn}" tall${l.oversize ? ' (oversize)' : ''}`,
        },
      },
      quantity: 1,
    })),
    ...(stripeCustomerId
      ? { customer: stripeCustomerId }
      : contact.value.email
        ? { customer_email: contact.value.email }
        : {}),
    metadata: {
      type: 'firing',
      source: 'glaze-qr',
      userId: customer.id,
      locationId: studio.id,
      pieces: piecesMeta,
      contactName: contact.value.name.slice(0, 120),
      contactPhone: contact.value.phone,
      textOptIn: body.textOptIn === false ? '0' : '1',
    },
    success_url: `${origin}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pay`,
  });

  return NextResponse.json({ url: checkout.url });
}
