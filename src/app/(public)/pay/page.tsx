import NextLink from 'next/link';
import { getFiringProducts } from '@/lib/pos';
import { glazePayStudio } from '@/lib/glazePay';
import { GlazePayForm } from './_components/GlazePayForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pay for glaze firing — Throw' };

function rate(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * The page behind the glazing-area poster QR code (/glaze → /pay): price a
 * piece by weight and height, add as many as you like, pay by card. No account
 * needed; the name and phone go on the pieces so the kiln queue and the
 * ready-for-pickup text work. Members who'd rather pay from their account
 * use /buy/firing.
 */
export default async function PayPage() {
  const [firing, studio] = await Promise.all([getFiringProducts(), glazePayStudio()]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <p className="t-eyebrow text-headline text-center text-[13px]">Glaze fire pricing</p>
      <h1 className="t-h-xl text-headline mt-2 text-center">Pay for firing</h1>
      {studio && (
        <p className="t-body-sm text-body mt-1 text-center">{studio.name} studio</p>
      )}
      <p className="t-body-sm text-body mt-3 text-center">
        Member?{' '}
        <NextLink
          href="/login?callbackUrl=/buy/firing"
          className="t-body-sm-bold text-headline underline underline-offset-4"
        >
          Sign in to pay from your account
        </NextLink>
      </p>

      {!firing || !studio ? (
        <p className="t-body-sm text-body mt-8 text-center">
          Firing payments aren’t set up online yet. Pay at the front desk for now.
        </p>
      ) : (
        <>
          <dl className="bg-sage-fill mt-6 grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-2">
            <div>
              <dt className="t-body-sm-bold text-headline">Standard glaze fire</dt>
              <dd className="t-body-sm text-body">
                {rate(firing.rates.standardCentsPerLb)} per pound, pieces 12 inches and under
              </dd>
            </div>
            <div>
              <dt className="t-body-sm-bold text-headline">Oversized pieces</dt>
              <dd className="t-body-sm text-body">
                {rate(firing.rates.oversizeCentsPerLb)} per pound, pieces over 12 inches
              </dd>
            </div>
            {firing.rates.minChargeCents > 0 && (
              <div className="sm:col-span-2">
                <dt className="t-body-sm-bold text-headline">Minimum</dt>
                <dd className="t-body-sm text-body">{rate(firing.rates.minChargeCents)} per piece</dd>
              </div>
            )}
          </dl>

          <GlazePayForm rates={firing.rates} />

        </>
      )}
    </div>
  );
}
