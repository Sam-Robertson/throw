'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { ArrowRight } from './icons';

type Slide = { node: React.ReactNode; key: string };

/**
 * Location block: a swipeable photo carousel with dot indicators, then the
 * studio name (serif), address (details grey), hours, and a primary CTA.
 *
 * Mobile draws the photo full-bleed with no radius and the address without a
 * link arrow; desktop rounds the photo and puts a → after the address that
 * opens the map. The dots track scroll position rather than being decorative.
 *
 * Photos are passed in pre-rendered because <SitePhoto> reads the filesystem
 * and so has to stay on the server side of the boundary.
 */
export function LocationCarousel({
  name,
  address,
  mapHref,
  hoursMobile,
  hoursDesktop,
  ctaMobile,
  ctaDesktop,
  href,
  slides,
}: {
  name: string;
  address: string;
  mapHref: string;
  hoursMobile: string[];
  hoursDesktop: string[];
  ctaMobile: string;
  ctaDesktop: string;
  href: string;
  slides: Slide[];
}) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(slides.length - 1, i)));
  }

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <section>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto md:rounded-[28px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((s) => (
          <div key={s.key} className="w-full shrink-0 snap-center">
            {s.node}
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="mt-5 flex justify-center gap-2.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show photo ${i + 1} of ${slides.length}`}
            aria-current={i === active}
            className={cn(
              'size-2 rounded-full transition-colors',
              i === active ? 'bg-body' : 'bg-details/60',
            )}
          />
        ))}
      </div>

      <div className="px-6 text-center md:px-0">
        <h3 className="t-h-xl text-headline mt-7">{name}</h3>

        {/* Mobile: plain address. Desktop: address + map arrow. */}
        <p className="t-body-lg text-details mt-3 md:hidden">{address}</p>
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className="text-details hover:text-body mt-2 hidden items-center justify-center gap-2 text-base transition-colors md:inline-flex"
        >
          {address}
          <ArrowRight className="size-5 text-black" />
        </a>

        <div className="mt-5 md:mt-4">
          <div className="md:hidden">
            {hoursMobile.map((line) => (
              <p key={line} className="t-body-lg-bold text-body">
                {line}
              </p>
            ))}
          </div>
          <div className="hidden md:block">
            {hoursDesktop.map((line) => (
              <p key={line} className="t-body-sm-bold text-body">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-7 md:mt-6">
          <Button href={href} block className="md:hidden">
            {ctaMobile}
          </Button>
          <Button href={href} className="hidden md:inline-flex md:min-w-[264px]">
            {ctaDesktop}
          </Button>
        </div>
      </div>
    </section>
  );
}
