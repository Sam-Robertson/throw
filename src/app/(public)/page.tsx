import { Button } from '@/components/site/Button';
import { InstructorRail } from '@/components/site/InstructorRail';
import { LocationCard } from '@/components/site/LocationCard';
import { OfferCard } from '@/components/site/OfferCard';
import { SitePhoto } from '@/components/site/SitePhoto';
import { Star } from '@/components/site/icons';
import {
  EVENTS,
  HERO,
  INSTRUCTORS,
  LOCATIONS,
  OFFERS,
  RATING,
  REVIEWS,
} from '@/content/site';

/**
 * Marketing home page — built to "Home (1).png" (mobile) and "Desktop.png",
 * revised to the designer's Oct 2026 review ("Mobile Home screen NIts" 1 + 2):
 * hero copy sits lower on desktop, shorter offer cards, location cards instead
 * of carousels, a name-only instructor rail, and no photo strip above the
 * footer; the 2026-10-15 desktop file then set the review cards straight
 * (white, sage stroke), the instructor names in Satoshi bold and the footer's
 * tagline in place of the wordmark.
 *
 * Mobile-first throughout. Where the two designs disagree on wording (hero CTA,
 * the events heading), both strings are rendered and toggled at `md`.
 */

function RatingLine({ className }: { className?: string }) {
  return (
    <p className={className}>
      <span className="t-body-lg-bold md:text-base">{RATING.score}</span>
      <Star className="mx-1 inline size-[1em] -translate-y-[2px]" />
      <span className="t-body-lg-bold md:text-base"> | {RATING.count}</span>
    </p>
  );
}


export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative">
        {/* A portrait photo of bisque-fired bowls (1702x2400). Cover-cropped:
            the phone shows most of it, desktop takes a landscape band from the
            middle where the big bowls are. */}
        <SitePhoto
          photo={HERO.photo}
          priority
          sizes="100vw"
          className="h-[560px] w-full md:h-[680px] [&_img]:object-[50%_45%]"
        />
        {/* The bowls are pale, so the type needs a real scrim: a bottom-heavy
            gradient that fades out by the top third, plus a faint overall
            tint so the white heading reads everywhere it can land. */}
        <div className="pointer-events-none absolute inset-0 bg-black/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

        {/* Desktop: the review asked for the heading and CTA "down a touch"
            from dead centre, so the block is centred on 58% rather than 50%. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-10 text-white md:top-[58%] md:bottom-auto md:-translate-y-1/2 md:pb-0">
          {/* At 60px this wraps to "Learn to" / "throw" on a 402px frame and
              sits on one line from md up, matching both comps without a
              hard-coded break. */}
          <h1 className="t-hero text-center">{HERO.heading}</h1>
          <RatingLine className="mt-5 text-center md:mt-6" />
          <Button
            href={HERO.href}
            variant="secondary"
            block
            className="mt-7 border-transparent md:hidden"
          >
            {HERO.ctaMobile}
          </Button>
          <Button
            href={HERO.href}
            variant="secondary"
            className="mt-6 hidden border-transparent md:inline-flex md:min-w-[320px]"
          >
            {HERO.ctaDesktop}
          </Button>
        </div>
      </section>

      {/* ── Offers ────────────────────────────────────────────────────────── */}
      <section className="bg-cream px-6 py-12 md:px-10 md:py-20">
        <div className="mx-auto grid w-full max-w-[1120px] gap-6 md:grid-cols-3 md:gap-8">
          {OFFERS.map((o) => (
            <OfferCard key={o.title} {...o} />
          ))}
        </div>
      </section>

      {/* ── Planning an event ─────────────────────────────────────────────── */}
      <section className="px-6 py-16 text-center md:px-10 md:py-24">
        <div className="mx-auto max-w-[720px]">
          <SitePhoto
            photo={EVENTS.illustration}
            fit="contain"
            sizes="(min-width: 768px) 320px, 260px"
            className="mx-auto h-[150px] w-[260px] md:h-[170px] md:w-[300px]"
          />
          <h2 className="t-h-lg md:text-[48px] md:leading-[52px] text-headline mt-6 md:hidden">
            {EVENTS.headingMobile}
          </h2>
          <h2 className="t-h-lg md:text-[48px] md:leading-[52px] text-headline mt-6 hidden md:block">
            {EVENTS.headingDesktop}
          </h2>
          <div className="mt-5 md:mt-6">
            {EVENTS.lines.map((line) => (
              <p key={line} className="t-body-lg text-body md:text-base md:leading-7">
                {line}
              </p>
            ))}
          </div>
          <Button href={EVENTS.href} block className="mt-8 md:hidden">
            {EVENTS.cta}
          </Button>
          <Button
            href={EVENTS.href}
            className="mt-7 hidden md:inline-flex md:min-w-[350px]"
          >
            {EVENTS.cta}
          </Button>
        </div>
      </section>

      {/* ── Locations ─────────────────────────────────────────────────────── */}
      {/* Mobile heads the section "2 Locations" and scrolls the cards sideways;
          desktop says "Locations" and sets them two across. */}
      <section className="pb-16 md:pb-24">
        <h2 className="t-h-xl text-headline px-6 pb-8 text-center md:px-10 md:pb-12">
          <span className="md:hidden">{LOCATIONS.length} Locations</span>
          <span className="hidden md:inline">Locations</span>
        </h2>
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-auto md:grid md:w-full md:max-w-[1040px] md:grid-cols-2 md:gap-10 md:overflow-visible md:px-10 md:pb-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {LOCATIONS.map((loc) => (
            <LocationCard
              key={loc.name}
              name={loc.name}
              address={loc.address}
              fullAddress={loc.fullAddress}
              mapHref={loc.mapHref}
              href={loc.href}
              className="w-[84vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none"
              photo={
                <SitePhoto
                  photo={loc.photo}
                  sizes="(min-width: 768px) 480px, 84vw"
                  className="bg-fill aspect-[11/10] w-full"
                />
              }
            />
          ))}
        </div>
      </section>

      {/* ── Instructors ───────────────────────────────────────────────────── */}
      <section className="bg-cream py-14 md:py-20">
        <h2 className="t-h-xl text-headline px-6 pb-8 text-center md:px-10 md:pb-12">
          Our instructors
        </h2>
        <InstructorRail
          cards={INSTRUCTORS.map((i) => ({
            key: i.name,
            instructor: i,
            photo: (
              <SitePhoto
                photo={i.photo}
                sizes="(min-width: 768px) 244px, 196px"
                className="bg-fill aspect-[3/4] w-full"
              />
            ),
          }))}
        />
      </section>

      {/* ── Reviews ───────────────────────────────────────────────────────── */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <h2 className="t-h-xl text-headline text-center">Reviews</h2>
        <RatingLine className="text-headline mt-5 text-center md:mt-4" />

        {/* Equal heights across the row (the designer's 2026-10-14 note). */}
        <div className="mx-auto mt-12 flex w-full max-w-[1120px] flex-col gap-8 md:mt-16 md:grid md:grid-cols-3 md:items-stretch md:gap-10">
          {/* Straight white cards with the sage stroke, per the designer's
              2026-10-15 desktop file (the Oct review's tilted cream cards are gone). */}
          {REVIEWS.map((r) => (
            <figure
              key={r.name}
              className="border-sage-stroke flex flex-col justify-center rounded-[32px] border bg-white px-7 py-8 text-center"
            >
              <blockquote className="text-headline text-[18px] leading-7 font-bold md:text-[19px] md:leading-8">
                {r.quote}
              </blockquote>
              <figcaption className="text-details mt-3 text-[14px] leading-6">
                {r.name}
                <span className="text-details mx-2">|</span>
                {r.product}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
