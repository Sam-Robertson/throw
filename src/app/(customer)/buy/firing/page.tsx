import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getFiringProducts } from '@/lib/pos';
import { shortName } from '@/lib/shop';
import { BackLink } from '@/components/shared/BackLink';
import { FiringKeypad } from './_components/FiringKeypad';

export const dynamic = 'force-dynamic';

/**
 * "Pay for firing" (Membership Portal design, Buy glaze firing): weigh each
 * piece on the keypad, tick it if it's over 12 inches, add it, then pay for
 * all of them through Stripe Checkout. Rates come from the two firing
 * products, the same ones the POS uses.
 */
export default async function BuyFiringPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/buy/firing');

  const [firing, membership] = await Promise.all([
    getFiringProducts(),
    prisma.membership.findFirst({
      where: { userId: session.user.id, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true },
    }),
  ]);
  const who = shortName(session.user.name);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <BackLink href="/dashboard">Home</BackLink>
      <h1 className="t-h-xl text-headline mt-4 text-center">Pay for firing</h1>
      {who && <p className="t-body-sm-bold text-headline mt-1 text-center">for {who}</p>}

      {!membership ? (
        <p className="t-body-sm text-body mt-8 text-center">
          Glaze firing is for members.{' '}
          <NextLink
            href="/membership/pick"
            className="t-body-sm-bold text-headline underline underline-offset-4"
          >
            Start a membership
          </NextLink>
        </p>
      ) : !firing ? (
        <p className="t-body-sm text-body mt-8 text-center">
          Firing payments aren’t set up online yet. Pay at the front desk for now.
        </p>
      ) : (
        <FiringKeypad rates={firing.rates} />
      )}
    </div>
  );
}
