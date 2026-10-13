import { Button } from './Button';
import { SitePhoto } from './SitePhoto';
import type { Photo } from '@/content/site';

/**
 * The three offer cards below the hero: white card, 1px sage-stroke border,
 * generous corner radius, a photo filling the top of the card, then title
 * (serif), price (Satoshi bold), a one-line blurb (Satoshi regular), and a
 * full-width primary button.
 *
 * Shortened in the Oct 2026 review ("these are too tall"): the photo is a
 * landscape 4:3 crop flush with the card's top instead of a square cut-out on
 * white, the copy is one line, and the spacing is tighter. Cards stretch to
 * equal height so the buttons line up across the row on desktop.
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
        sizes="(min-width: 768px) 33vw, 100vw"
        className="bg-fill aspect-[4/3] w-full"
      />

      <div className="flex flex-1 flex-col px-6 pt-5 pb-6 text-center">
        <h3 className="t-h-lg text-headline">{title}</h3>
        <p className="t-body-sm-bold text-body mt-1">{price}</p>
        <p className="t-body-sm text-body mt-3">{blurb}</p>
        <div className="mt-auto pt-5">
          <Button href={href} block>
            {cta}
          </Button>
        </div>
      </div>
    </article>
  );
}
