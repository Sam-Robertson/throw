import { redirect } from 'next/navigation';
import { retrieveCheckoutSessionAnyAccount } from '@/lib/stripe';
import { parseFiringPiecesMeta } from '@/lib/shop';
import { Receipt } from '@/components/site/Receipt';

export const dynamic = 'force-dynamic';

/**
 * After Stripe Checkout from the poster's pay page. The session id in the
 * URL is the only key (it is unguessable), so no sign-in is asked for; only
 * a paid glaze-firing session from that page is shown.
 */
export default async function PayThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) redirect('/pay');

  const found = await retrieveCheckoutSessionAnyAccount(session_id).catch(() => null);
  const checkout = found?.session;
  if (!checkout || checkout.metadata?.source !== 'glaze-qr' || checkout.payment_status !== 'paid') {
    redirect('/pay');
  }

  const pieces = parseFiringPiecesMeta(checkout.metadata?.pieces ?? '');
  const name = checkout.metadata?.contactName;
  return (
    <Receipt
      eyebrow="Paid for firing"
      heading="Thank you!"
      note={`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}${name ? ` for ${name}` : ''}. We'll text you when they're ready.`}
      lines={pieces.map((p) => ({
        label: `${p.weightLb.toFixed(1)} lb piece${p.oversize ? ' (oversize)' : ''}`,
        amount: p.chargeCents,
      }))}
      taxCents={checkout.total_details?.amount_tax ?? 0}
      totalCents={checkout.amount_total ?? 0}
      confirmation={checkout.id}
    />
  );
}
