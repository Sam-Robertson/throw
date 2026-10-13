import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeForLocation } from '@/lib/stripe';
import { findStripeCustomerId } from '@/lib/stripeCustomers';
import { CLAY_CATEGORY, studioForMember } from '@/lib/shop';

/**
 * POST /api/shop/clay/checkout { productId } → { url }
 *
 * A Stripe Checkout Session for one bag of clay, in the member's studio's
 * account. The webhook records the payment and leaves the front desk a task
 * to hand the bag over (checkout.session.completed, metadata.type "clay").
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => null)) as { productId?: string } | null;
  if (!body?.productId)
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });

  const product = await prisma.retailProduct.findFirst({
    where: {
      id: body.productId,
      category: CLAY_CATEGORY,
      isActive: true,
      isPriced: true,
      archivedAt: null,
    },
  });
  if (!product)
    return NextResponse.json({ error: 'That clay isn’t on sale right now.' }, { status: 404 });

  const studio = await studioForMember(userId);
  if (!studio) return NextResponse.json({ error: 'No studio to collect from.' }, { status: 409 });

  const account = await stripeForLocation(studio.id);
  const customerId = await findStripeCustomerId(account, userId);
  const origin =
    req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const checkout = await account.client.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: product.priceCents,
          product_data: {
            name: `25 lb ${product.name} clay`,
            description: `Collect at the front desk, ${studio.name}`,
          },
        },
        quantity: 1,
      },
    ],
    ...(customerId
      ? { customer: customerId }
      : { customer_email: session.user.email ?? undefined }),
    metadata: {
      type: 'clay',
      userId,
      locationId: studio.id,
      productId: product.id,
      productName: product.name,
    },
    success_url: `${origin}/buy/clay/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/buy/clay`,
  });

  return NextResponse.json({ url: checkout.url });
}
