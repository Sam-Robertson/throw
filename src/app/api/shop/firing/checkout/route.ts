import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeForLocation } from '@/lib/stripe';
import { findStripeCustomerId } from '@/lib/stripeCustomers';
import { getFiringProducts } from '@/lib/pos';
import { quoteMemberFiring } from '@/lib/firing';
import { studioForMember } from '@/lib/shop';

const MAX_PIECES = 20;

/**
 * POST /api/shop/firing/checkout { pieces: [{ weightLb, oversize }] } → { url }
 *
 * Prices the pieces with the same rules as the POS (src/lib/firing.ts) and
 * opens a Stripe Checkout Session in the member's studio's account, one line
 * per piece. The webhook records the payment and the pieces
 * (checkout.session.completed, metadata.type "firing").
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const membership = await prisma.membership.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } },
    select: { id: true },
  });
  if (!membership)
    return NextResponse.json({ error: 'Glaze firing is for members.' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    pieces?: { weightLb?: unknown; oversize?: unknown }[];
  } | null;
  const raw = Array.isArray(body?.pieces) ? body.pieces : [];
  if (raw.length === 0)
    return NextResponse.json({ error: 'Add at least one piece.' }, { status: 400 });
  if (raw.length > MAX_PIECES) {
    return NextResponse.json({ error: `Up to ${MAX_PIECES} pieces at a time.` }, { status: 400 });
  }
  const pieces = raw.map((p) => ({ weightLb: Number(p.weightLb), oversize: p.oversize === true }));

  const firing = await getFiringProducts();
  if (!firing)
    return NextResponse.json({ error: 'Firing payments aren’t set up yet.' }, { status: 503 });
  const quote = quoteMemberFiring(pieces, firing.rates);
  if (!quote.ok) return NextResponse.json({ error: quote.reason }, { status: 400 });

  const studio = await studioForMember(userId);
  if (!studio) return NextResponse.json({ error: 'No studio on file.' }, { status: 409 });

  const account = await stripeForLocation(studio.id);
  const customerId = await findStripeCustomerId(account, userId);
  const origin =
    req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Stripe metadata values are capped at 500 characters; 20 pieces of
  // "1.2:0" fit comfortably.
  const piecesMeta = quote.lines
    .map((l) => `${l.weightLb}:${l.oversize ? 1 : 0}:${l.chargeCents}`)
    .join(',');

  const checkout = await account.client.checkout.sessions.create({
    mode: 'payment',
    line_items: quote.lines.map((l) => ({
      price_data: {
        currency: 'usd',
        unit_amount: l.chargeCents,
        product_data: {
          name: `Glaze firing, ${l.weightLb.toFixed(1)} lb piece${l.oversize ? ' (over 12 in)' : ''}`,
        },
      },
      quantity: 1,
    })),
    ...(customerId
      ? { customer: customerId }
      : { customer_email: session.user.email ?? undefined }),
    metadata: {
      type: 'firing',
      userId,
      locationId: studio.id,
      pieces: piecesMeta,
    },
    success_url: `${origin}/buy/firing/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/buy/firing`,
  });

  return NextResponse.json({ url: checkout.url });
}
