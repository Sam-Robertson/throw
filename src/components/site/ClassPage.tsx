import { Button } from './Button';
import { FaqList } from './FaqList';
import { InstructorRail } from './InstructorRail';
import { PhotoCarousel } from './PhotoCarousel';
import { ReviewsSection } from './ReviewsSection';
import { SitePhoto } from './SitePhoto';
import { CalendarIcon, CheckIcon, GroupIcon, InfoIcon, PinIcon, PriceIcon } from './icons';
import { type ClassPage as ClassPageData, type DetailRow } from '@/content/classes';
import { INSTRUCTORS } from '@/content/site';

/**
 * Shared layout for the four class/event pages, to the designer's Oct 2026
 * "Drop in class" design. See src/content/classes.ts for the per-page data
 * and which sections are optional.
 *
 * Top to bottom: title and intro; the steps as a row of square photos; a split
 * band with the class photo on the left and a "Class details" card on the
 * right (When / Where / Price / What's included, with the book button in the
 * card's corner); "What you'll make" as an edge-to-edge photo carousel; the
 * drop-in group CTA; the instructor rail; reviews; FAQs.
 *
 * The mobile design for this revision has not been supplied, so below md the
 * steps stay a list, the split band stacks (photo, then card) and the book
 * button stays pinned to the foot of the screen as before.
 */

const ICONS = {
  when: CalendarIcon,
  where: PinIcon,
  price: PriceIcon,
  group: GroupIcon,
} as const;

/** Renders `**bold**` runs — the price copy bolds its total ("$50 total."). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="text-headline font-bold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function DetailBlock({ row }: { row: DetailRow }) {
  const Icon = ICONS[row.icon];
  return (
    <div>
      <div className="text-headline flex items-center gap-2">
        <Icon className="size-5" />
        <h3 className="t-body-sm-bold">{row.label}</h3>
      </div>

      <div className="mt-2.5">
        {row.isWhere ? (
          <p className="t-body-sm text-body">
            Our{' '}
            <a href="/about#locations" className="underline underline-offset-4">
              Lehi studio
            </a>{' '}
            or{' '}
            <a href="/about#locations" className="underline underline-offset-4">
              Provo studio
            </a>
            . Choose at booking.
          </p>
        ) : row.tiers ? (
          row.tiers.map((t) => (
            <div key={t.label} className="mt-5 first:mt-0">
              <p className="t-eyebrow text-headline text-[13px]">{t.label}</p>
              {t.body.map((line) => (
                <p key={line} className="t-body-sm text-body">
                  {line}
                </p>
              ))}
            </div>
          ))
        ) : (
          row.body?.map((line) => (
            <p key={line} className="t-body-sm text-body">
              <RichText text={line} />
            </p>
          ))
        )}
      </div>
    </div>
  );
}

export function ClassPage({ page }: { page: ClassPageData }) {
  return (
    <>
      {/* ── Title + intro ─────────────────────────────────────────────────── */}
      <section className="px-6 pt-10 text-center md:px-10 md:pt-14">
        <div className="mx-auto max-w-[760px]">
          <h1 className="t-h-xl text-headline">{page.title}</h1>
          {page.eyebrow && <p className="t-eyebrow text-details mt-2">{page.eyebrow}</p>}
          <p className="t-body-lg text-body mt-4 md:text-base md:leading-7">{page.intro}</p>
        </div>
      </section>

      {/* ── Steps: a row of square photos on desktop, a list on mobile ──── */}
      <section className="px-6 pt-8 md:px-10 md:pt-10">
        <div
          className="mx-auto flex max-w-[760px] flex-col gap-7 md:grid md:max-w-[880px] md:grid-cols-[repeat(var(--steps),minmax(0,1fr))] md:gap-8"
          style={{ ['--steps' as string]: page.steps.length }}
        >
          {page.steps.map((s) => (
            <div key={s.label} className="flex items-center gap-6 md:block">
              <SitePhoto
                photo={s.photo}
                sizes="(min-width: 768px) 260px, 132px"
                className="bg-fill size-[132px] shrink-0 rounded-2xl md:aspect-square md:size-auto md:w-full"
              />
              <div className="min-w-0 md:mt-4">
                <h3 className="t-eyebrow text-headline text-[13px]">{s.label}</h3>
                <p className="t-body-lg text-body mt-1 md:text-[15px] md:leading-6">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kickstarter: product row + pick-up caption ────────────────────── */}
      {page.pickup && (
        <section className="pt-14 md:pt-16">
          <div className="grid grid-cols-3 gap-4 px-6 md:mx-auto md:max-w-[760px] md:px-10">
            {page.pickup.photos.map((p) => (
              <SitePhoto
                key={p.src}
                photo={p}
                fit="contain"
                sizes="33vw"
                className="aspect-square w-full"
              />
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-[560px] px-6 text-center">
            <h2 className="t-eyebrow text-headline">{page.pickup.label}</h2>
            <p className="t-body-lg text-body mt-3 md:text-base md:leading-7">{page.pickup.body}</p>
          </div>
        </section>
      )}

      {/* ── Group events: "Doing something special?" band ─────────────────── */}
      {page.specialBand && (
        <section className="bg-cream mt-14 px-6 py-12 text-center md:mt-16 md:px-10">
          <div className="mx-auto max-w-[620px]">
            <SitePhoto
              photo={page.specialBand.illustration}
              fit="contain"
              sizes="150px"
              className="mx-auto h-[130px] w-[150px]"
            />
            <h2 className="t-h-lg text-headline mt-4">{page.specialBand.heading}</h2>
            <p className="t-body-lg text-body mt-3 md:text-base md:leading-7">
              {page.specialBand.body}
            </p>
          </div>
        </section>
      )}

      {/* ── Details: photo left, card right ───────────────────────────────── */}
      <section className="mt-14 md:mt-20 md:grid md:grid-cols-2">
        <SitePhoto
          photo={page.hero}
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-[330px] w-full md:h-full md:min-h-[680px]"
        />
        <div className="bg-cream flex items-center px-6 py-10 md:px-12 md:py-16 lg:px-20">
          <div className="border-sage-stroke w-full max-w-[640px] rounded-[28px] border bg-white px-6 py-8 md:px-10 md:py-10">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h2 className="text-headline font-serif text-[32px] leading-10 md:text-[40px] md:leading-[46px]">
                  {page.detailsHeading}
                </h2>
                {page.detailsEyebrow && (
                  <p className="t-eyebrow text-details mt-1 text-[13px]">{page.detailsEyebrow}</p>
                )}
              </div>
              <Button
                href={page.bookHref}
                className="hidden h-10 shrink-0 px-6 text-[15px] md:inline-flex md:h-10"
              >
                {page.bookCta}
              </Button>
            </div>

            <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {page.details.map((row) => (
                <DetailBlock key={row.label} row={row} />
              ))}

              <div>
                <h3 className="t-body-sm-bold text-headline">What’s included?</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {page.included.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <CheckIcon className="text-rust mt-1 size-4 shrink-0" />
                      <span className="t-body-sm text-body">{item.text}</span>
                      {item.hasInfo && (
                        <InfoIcon className="text-headline mt-1.5 size-4 shrink-0" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you'll make ──────────────────────────────────────────────── */}
      <section className="pt-16 md:pt-24">
        <div className="px-6 text-center md:px-10">
          <h2 className="t-h-xl text-headline">{page.makeHeading}</h2>
          <p className="t-body-sm text-body mt-3">{page.makeSubhead}</p>
        </div>
        <PhotoCarousel
          className="mt-8"
          tileClassName="w-[78vw] max-w-[510px] aspect-[17/15]"
          items={page.makePhotos.map((p) => ({
            key: p.src,
            node: (
              <SitePhoto
                photo={p}
                fit="contain"
                sizes="(min-width: 768px) 510px, 78vw"
                className="h-full w-full bg-[#f4f4f4]"
              />
            ),
          }))}
        />
      </section>

      {/* ── Drop-in: "Planning for a group?" ──────────────────────────────── */}
      {page.groupCta && (
        <section className="px-6 pt-16 text-center md:px-10 md:pt-20">
          <div className="mx-auto max-w-[620px]">
            <SitePhoto
              photo={page.groupCta.illustration}
              fit="contain"
              sizes="260px"
              className="mx-auto h-[150px] w-[260px]"
            />
            <h2 className="t-h-lg text-headline mt-5">{page.groupCta.heading}</h2>
            <p className="t-body-lg text-body mt-3 md:text-base md:leading-7">
              {page.groupCta.body}
            </p>
            <Button href={page.groupCta.href} block className="mt-7 md:hidden">
              {page.groupCta.cta}
            </Button>
            <Button href={page.groupCta.href} className="mt-7 hidden md:inline-flex md:px-10">
              {page.groupCta.cta}
            </Button>
          </div>
        </section>
      )}

      {/* ── Instructors ───────────────────────────────────────────────────── */}
      <section className="bg-cream mt-16 py-14 md:mt-20 md:py-20">
        <h2 className="t-h-xl text-headline px-6 pb-8 text-center md:px-10 md:pb-12">
          Meet our instructors
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
      <ReviewsSection className="pt-16 md:pt-24" />

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-20 md:px-10 md:pt-24 md:pb-24">
        <div className="mx-auto max-w-[760px]">
          <SitePhoto
            photo={{
              src: '/site/illo-pot-faq.svg',
              alt: 'A pottery character holding a list',
            }}
            fit="contain"
            sizes="200px"
            className="mx-auto h-[150px] w-[160px]"
          />
          <h2 className="t-h-xl text-headline mt-4 mb-6 text-center">FAQ’s</h2>
          <FaqList faqs={page.faqs} />
        </div>
      </section>

      {/* ── Sticky book bar (mobile) ──────────────────────────────────────────
          Desktop has the button in the details card. On phones it stays pinned
          over the page. Being fixed it is out of flow, so the marker below is
          picked up by a `body:has([data-sticky-cta]) footer` rule in
          globals.css, which pads the footer by the bar's height. */}
      <div data-sticky-cta hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-5 md:hidden">
        <div className="pointer-events-auto mx-auto max-w-[760px]">
          <Button href={page.bookHref} block className="shadow-lg">
            {page.bookCta}
          </Button>
        </div>
      </div>
    </>
  );
}
