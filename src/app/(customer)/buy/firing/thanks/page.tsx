import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { retrieveCheckoutSessionAnyAccount } from '@/lib/stripe';
import { parseFiringPiecesMeta } from '@/lib/shop';
import { Receipt } from '@/components/site/Receipt';

export const dynamic = 'force-dynamic';

/** After Stripe Checkout for firing: "Paid for firing — Thank you!" with each piece. */
export default async function FiringThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');
  const { session_id } = await searchParams;
  if (!session_id) redirect('/buy/firing');

  const found = await retrieveCheckoutSessionAnyAccount(session_id).catch(() => null);
  if (!found || found.session.metadata?.userId !== session.user.id) redirect('/buy/firing');
  const { session: checkout } = found;
  if (checkout.payment_status !== 'paid') redirect('/buy/firing');

  const pieces = parseFiringPiecesMeta(checkout.metadata?.pieces ?? '');
  return (
    <Receipt
      eyebrow="Paid for firing"
      heading="Thank you!"
      note={`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`}
      lines={pieces.map((p) => ({
        label: `${p.weightLb.toFixed(1)} lb piece${p.oversize ? ' (over 12 in)' : ''}`,
        amount: p.chargeCents,
      }))}
      taxCents={checkout.total_details?.amount_tax ?? 0}
      totalCents={checkout.amount_total ?? 0}
      confirmation={checkout.id}
    />
  );
}
