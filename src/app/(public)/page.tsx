import { Button } from '@/components/site/Button';
import { InstructorRail } from '@/components/site/InstructorRail';
import { LocationCarousel } from '@/components/site/LocationCarousel';
import { OfferCard } from '@/components/site/OfferCard';
import { SitePhoto } from '@/components/site/SitePhoto';
import { Star } from '@/components/site/icons';
import {
  EVENTS,
  HERO,
  INSTRUCTORS,
  LOCATIONS,
  OFFERS,
  PHOTO_STRIP,
  RATING,
  REVIEWS,
} from '@/content/site';

/**
 * Marketing home page — built to "Home (1).png" (mobile) and "Desktop.png".
 *
 * Mobile-first throughout. Where the two designs disagree on wording (hero CTA,
 * the events heading, the location CTAs and hours, the instructors heading),
 * both strings are rendered and toggled at `md` rather than picking one.
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
        <SitePhoto
          photo={HERO.photo}
          priority
          sizes="100vw"
          className="h-[560px] w-full md:h-[660px]"
        />
        {/* The photo is dark enough at the foot to carry white type; a soft
            scrim keeps it legible whatever crop the final image lands on. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-10 text-white md:pb-0 md:top-1/2 md:-translate-y-1/2 md:justify-center">
          {/* At 60px this wraps to "Learn to" / "throw" on a 402px frame and
              sits on one line from md up, matching both comps without a
              hard-coded break. */}
          <h1 className="t-hero text-center">
            {HERO.heading}
          </h1>
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
      <section className="bg-cream px-6 py-14 md:px-10 md:py-24">
        <div className="mx-auto grid w-full max-w-[1264px] gap-8 md:grid-cols-3 md:gap-10">
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
      <section className="pb-16 md:pb-24">
        <h2 className="t-h-xl text-headline px-6 pb-10 text-center md:px-10 md:pb-14">
          Locations
        </h2>
        <div className="mx-auto grid w-full max-w-[1264px] gap-16 md:grid-cols-2 md:gap-10 md:px-10">
          {LOCATIONS.map((loc) => (
            <LocationCarousel
              key={loc.name}
              name={loc.name}
              address={loc.address}
              mapHref={loc.mapHref}
              hoursMobile={loc.hoursMobile}
              hoursDesktop={loc.hoursDesktop}
              ctaMobile={loc.ctaMobile}
              ctaDesktop={loc.ctaDesktop}
              href={loc.href}
              slides={loc.photos.map((p) => ({
                key: p.src,
                node: (
                  <SitePhoto
                    photo={p}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="aspect-[4/3] w-full md:rounded-[28px]"
                  />
                ),
              }))}
            />
          ))}
        </div>
      </section>

      {/* ── Instructors ───────────────────────────────────────────────────── */}
      <section className="bg-cream py-14 md:py-20">
        <h2 className="t-h-xl text-headline px-6 pb-8 text-center md:px-10 md:pb-12 md:hidden">
          Our instructors
        </h2>
        <h2 className="t-h-xl text-headline hidden px-10 pb-12 text-center md:block">
          Meet our instructors
        </h2>
        <InstructorRail
          cards={INSTRUCTORS.map((i) => ({
            key: i.name,
            instructor: i,
            photo: (
              <SitePhoto
                photo={i.photo}
                sizes="264px"
                className="aspect-[3/4] w-full"
              />
            ),
          }))}
        />
      </section>

      {/* ── Reviews ───────────────────────────────────────────────────────── */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <h2 className="t-h-xl text-headline text-center">Reviews</h2>
        <RatingLine className="text-headline mt-5 text-center md:mt-4" />

        <div className="mx-auto mt-12 grid w-full max-w-[1264px] gap-16 md:mt-14 md:grid-cols-3 md:gap-10">
          {REVIEWS.map((r) => (
            <figure key={r.name} className="text-center">
              <blockquote className="t-h-xl text-headline">
                {r.quote}
              </blockquote>
              <figcaption className="mt-7 md:mt-8">
                <span className="t-body-lg-bold text-body block md:text-base">
                  {r.name}
                </span>
                <span className="t-body-lg text-body mt-2 block md:mt-1 md:text-sm">
                  {r.product}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Community photo strip ─────────────────────────────────────────── */}
      <section aria-label="Life at the studio" className="grid grid-cols-2 md:grid-cols-4">
        {PHOTO_STRIP.map((p) => (
          <SitePhoto
            key={p.src}
            photo={p}
            sizes="(min-width: 768px) 25vw, 50vw"
            className="aspect-square w-full md:aspect-[4/3]"
          />
        ))}
      </section>
    </>
  );
}
