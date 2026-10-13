import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getClayProducts, shortName, studioForMember } from '@/lib/shop';
import { SitePhoto } from '@/components/site/SitePhoto';
import { BackLink } from '@/components/shared/BackLink';
import { ClayPicker } from './_components/ClayPicker';

export const dynamic = 'force-dynamic';

const CLAY_PHOTOS: Record<string, string> = {
  'clay-bmix-25lb': '/site/clay-bmix.png',
  'clay-chestnut-25lb': '/site/clay-chestnut.png',
  'clay-aspen-porcelain-25lb': '/site/clay-aspen.png',
};

/**
 * "Pick a type of clay" (Membership Portal design, Buy clay): the 25 lb bags
 * as a pick list, then Stripe Checkout. The bag is collected at the front
 * desk of the member's studio.
 */
export default async function BuyClayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/buy/clay');

  const [products, studio] = await Promise.all([
    getClayProducts(),
    studioForMember(session.user.id),
  ]);
  const who = shortName(session.user.name);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <BackLink href="/dashboard">Home</BackLink>
      <h1 className="t-h-xl text-headline mt-4 text-center">Pick a type of clay</h1>
      {who && <p className="t-body-sm-bold text-headline mt-1 text-center">for {who}</p>}
      {studio && (
        <p className="text-body mt-1 text-center text-[13px] leading-5">
          Pick it up at the front desk at {studio.name}
        </p>
      )}

      {products.length === 0 ? (
        <p className="t-body-sm text-body mt-8 text-center">
          Clay isn’t on sale online yet.{' '}
          <NextLink
            href="/dashboard"
            className="t-body-sm-bold text-headline underline underline-offset-4"
          >
            Back
          </NextLink>
        </p>
      ) : (
        <ClayPicker
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            photo: (
              <SitePhoto
                photo={{
                  src: p.imageUrl ?? CLAY_PHOTOS[p.slug ?? ''] ?? '/site/clay-bmix.png',
                  alt: p.name,
                }}
                sizes="88px"
                className="bg-fill size-[72px] shrink-0 rounded-full"
              />
            ),
          }))}
        />
      )}
    </div>
  );
}
