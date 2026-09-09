import { Button } from './Button';
import { SitePhoto } from './SitePhoto';
import type { Photo } from '@/content/site';

/**
 * The three offer cards below the hero: white card, 1px sage-stroke border,
 * generous corner radius, a cut-out product photo on white, then title (serif),
 * price (Satoshi bold), blurb (Satoshi regular), and a full-width primary
 * button pinned to the bottom.
 *
 * Cards sit on the creme background and stretch to equal height so the buttons
 * line up across the row on desktop.
 */
export function OfferCard({
  title,
  price,
  blurb,
  cta,
  href,
  photo,
}: {
  title: string;
  price: string;
  blurb: string;
  cta: string;
  href: string;
  photo: Photo;
}) {
  return (
    <article className="border-sage-stroke flex flex-col overflow-hidden rounded-[28px] border bg-white">
      <SitePhoto
        photo={photo}
        fit="contain"
        sizes="(min-width: 768px) 33vw, 100vw"
        className="aspect-square w-full bg-white"
      />

      <div className="flex flex-1 flex-col px-6 pb-6 text-center md:px-5">
        <h3 className="t-h-lg text-headline">{title}</h3>
        <p className="t-body-sm-bold text-body mt-2 md:mt-1">{price}</p>
        <p className="t-body-sm text-body mt-5 md:mt-3">{blurb}</p>
        {/* Full-bleed within the card on mobile. On desktop all three cards use
            the same 220px button regardless of label length — measured at 222,
            221 and 220px across the three cards in Desktop.png — so it is a
            fixed width there rather than padding around the text. */}
        <div className="mt-auto pt-7 md:pt-5">
          <Button href={href} block className="md:w-[220px]">
            {cta}
          </Button>
        </div>
      </div>
    </article>
  );
}
