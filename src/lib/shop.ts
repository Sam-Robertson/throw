import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { defaultStudioLocationId } from '@/lib/locations';

/**
 * What members can buy from the portal: a bag of clay (one product per clay
 * body, category CLAY) and glaze firing by weight (the two FIRING products the
 * POS also prices from, see getFiringProducts in src/lib/pos.ts). Both are
 * catalog rows, so prices are changed in admin or scripts/sync-products.ts,
 * never here.
 */

export const CLAY_CATEGORY = 'CLAY';

export async function getClayProducts() {
  return prisma.retailProduct.findMany({
    where: { category: CLAY_CATEGORY, isActive: true, isPriced: true, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      priceCents: true,
      imageUrl: true,
      description: true,
    },
  });
}

/**
 * The studio a member's purchase belongs to (and so which Stripe account
 * takes the money and which front desk hands over the bag): the studio of
 * their current membership, else the default studio.
 */
export async function studioForMember(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'PAUSED'] }, locationId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { locationId: true },
  });
  const locationId = membership?.locationId ?? (await defaultStudioLocationId());
  if (!locationId) return null;
  return prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, address: true },
  });
}

/** "Sydney R" — first name and last initial, as the designs address the member. */
export function shortName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`;
}

/** The firing checkout packs its pieces into metadata as "weightLb:oversize:cents,…". */
export function parseFiringPiecesMeta(
  meta: string,
): { weightLb: number; oversize: boolean; chargeCents: number }[] {
  return meta
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [w, o, c] = part.split(':');
      return { weightLb: Number(w), oversize: o === '1', chargeCents: Number(c) };
    })
    .filter((p) => Number.isFinite(p.weightLb) && Number.isFinite(p.chargeCents));
}

/**
 * The webhook's half of a portal purchase (checkout.session.completed with
 * metadata.type "clay" or "firing"): a Payment row for the revenue report,
 * then, for clay, a front-desk task to hand the bag over, and for firing,
 * one Piece per paid piece so the kiln queue sees them. Idempotent on the
 * PaymentIntent id, so a retried delivery changes nothing.
 */
export async function recordShopPurchase(checkout: Stripe.Checkout.Session): Promise<void> {
  const meta = checkout.metadata ?? {};
  const type = meta.type;
  const userId = meta.userId;
  const locationId = meta.locationId;
  const paymentIntentId =
    typeof checkout.payment_intent === 'string'
      ? checkout.payment_intent
      : checkout.payment_intent?.id;
  if (!userId || !locationId || !paymentIntentId) {
    console.warn(
      `[stripe webhook] ${type} checkout ${checkout.id} is missing metadata; not recorded`,
    );
    return;
  }

  const existing = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (existing) return;

  await prisma.payment.create({
    data: {
      userId,
      locationId,
      stripePaymentIntentId: paymentIntentId,
      amountInCents: checkout.amount_total ?? 0,
      status: 'SUCCEEDED',
      type: 'OTHER',
      metadata: { kind: type, checkoutSessionId: checkout.id, ...meta },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const who = user?.name ?? user?.email ?? 'a member';

  if (type === 'clay') {
    await prisma.staffTask.create({
      data: {
        title: `Clay paid online: 25 lb ${meta.productName ?? 'clay'} for ${who}`,
        description: `Paid ${((checkout.amount_total ?? 0) / 100).toFixed(2)} through the member portal. Hand the bag over at the front desk and mark this done.`,
        triggerType: 'AUTOMATION',
        createdById: userId,
        linkedCustomerId: userId,
        locationId,
      },
    });
    return;
  }

  if (type === 'firing') {
    const pieces = parseFiringPiecesMeta(meta.pieces ?? '');
    for (const p of pieces) {
      await prisma.piece.create({
        data: {
          userId,
          locationId,
          pieceCount: 1,
          description: `Glaze firing paid online: ${p.weightLb.toFixed(1)} lb${p.oversize ? ', over 12 in' : ''}`,
          photoUrls: [],
          sharePermission: false,
          status: 'GLAZE',
          weightOz: Math.round(p.weightLb * 16),
          chargedCents: p.chargeCents,
          staffNote: `Paid online, Stripe ${checkout.id}`,
        },
      });
    }
  }
}
