import { prisma } from '@/lib/prisma';
import { defaultStudioLocationId } from '@/lib/locations';

/**
 * The studio the public glaze-firing page (/pay, behind the poster QR code)
 * sells for: GLAZE_PAY_STUDIO by name, else the Squarespace widget's
 * PREORDER_STUDIO, else Lehi, else the default studio. Its Stripe account
 * takes the money and its kiln queue gets the pieces.
 */
export async function glazePayStudio() {
  const wanted = (process.env.GLAZE_PAY_STUDIO ?? process.env.PREORDER_STUDIO ?? 'Lehi').trim();
  const byName = await prisma.location.findFirst({
    where: { name: { equals: wanted, mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true },
  });
  if (byName) return byName;
  const fallbackId = await defaultStudioLocationId();
  return fallbackId
    ? prisma.location.findUnique({ where: { id: fallbackId }, select: { id: true, name: true } })
    : null;
}

/** Pieces over this height are charged at the oversize rate (catalog §3.1). */
export const OVERSIZE_HEIGHT_IN = 12;
