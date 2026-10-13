import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { retrieveCheckoutSessionAnyAccount } from '@/lib/stripe';
import { Receipt } from '@/components/site/Receipt';

export const dynamic = 'force-dynamic';

/** After Stripe Checkout for a bag of clay: "Thank you!" with the order summary. */
export default async function ClayThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');
  const { session_id } = await searchParams;
  if (!session_id) redirect('/buy/clay');

  const found = await retrieveCheckoutSessionAnyAccount(session_id).catch(() => null);
  if (!found || found.session.metadata?.userId !== session.user.id) redirect('/buy/clay');
  const { session: checkout } = found;
  if (checkout.payment_status !== 'paid') redirect('/buy/clay');

  const name = checkout.metadata?.productName ?? 'clay';
  return (
    <Receipt
      eyebrow="Paid for clay"
      heading="Thank you!"
      note="Pick your bag up at the front desk."
      lines={[
        {
          label: `1 × 25 lb ${name} clay`,
          amount: checkout.amount_subtotal ?? checkout.amount_total ?? 0,
        },
      ]}
      taxCents={checkout.total_details?.amount_tax ?? 0}
      totalCents={checkout.amount_total ?? 0}
      confirmation={checkout.id}
    />
  );
}
