import { Button } from './Button';
import { FaqList } from './FaqList';
import { InstructorRail } from './InstructorRail';
import { SitePhoto } from './SitePhoto';
import {
  CalendarIcon,
  CheckIcon,
  GroupIcon,
  InfoIcon,
  PinIcon,
  PriceIcon,
  Star,
} from './icons';
import {
  CLASS_REVIEWS,
  PRODUCT_ROW,
  REVIEW_PHOTOS,
  type ClassPage as ClassPageData,
  type DetailRow,
} from '@/content/classes';
import { INSTRUCTORS } from '@/content/site';

/**
 * Shared layout for the four class/event pages. See src/content/classes.ts for
 * the per-page data and which sections are optional.
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
    <div className="mt-9 first:mt-0">
      <div className="text-headline flex items-center gap-2.5">
        <Icon className="size-6" />
        <h3 className="t-body-lg-bold md:text-base">{row.label}</h3>
      </div>

      <div className="mt-3">
        {row.isWhere ? (
          <p className="t-body-lg text-body md:text-base md:leading-7">
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
            <div key={t.label} className="mt-6 first:mt-0">
              <p className="t-eyebrow text-headline">{t.label}</p>
              {t.body.map((line) => (
                <p
                  key={line}
                  className="t-body-lg text-body md:text-base md:leading-7"
                >
                  {line}
                </p>
              ))}
            </div>
          ))
        ) : (
          row.body?.map((line) => (
            <p
              key={line}
              className="t-body-lg text-body md:text-base md:leading-7"
            >
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
      {/* ── Hero photo ────────────────────────────────────────────────────── */}
      <SitePhoto
        photo={page.hero}
        priority
        sizes="100vw"
        className="h-[330px] w-full md:h-[480px]"
      />

      {/* ── Title + intro ─────────────────────────────────────────────────── */}
      <section className="px-6 pt-12 text-center md:px-10 md:pt-16">
        <div className="mx-auto max-w-[760px]">
          <h1 className="t-h-xl text-headline">{page.title}</h1>
          {page.eyebrow && (
            <p className="t-eyebrow text-details mt-2">{page.eyebrow}</p>
          )}
          <p className="t-body-lg text-body mt-5 md:text-base md:leading-7">
            {page.intro}
          </p>
        </div>
      </section>

      {/* ── Steps ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-10 md:px-10 md:pt-14">
        <div className="mx-auto flex max-w-[760px] flex-col gap-7">
          {page.steps.map((s) => (
            <div key={s.label} className="flex items-center gap-6">
              <SitePhoto
                photo={s.photo}
                sizes="132px"
                className="size-[132px] shrink-0 rounded-2xl"
              />
              <div className="min-w-0">
                <h3 className="t-eyebrow text-headline">{s.label}</h3>
                <p className="t-body-lg text-body mt-1 md:text-base md:leading-7">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kickstarter: product row + pick-up caption ────────────────────── */}
      {page.pickup && (
        <section className="pt-16 md:pt-20">
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
            <p className="t-body-lg text-body mt-3 md:text-base md:leading-7">
              {page.pickup.body}
            </p>
          </div>
        </section>
      )}

      {/* ── Group events: "Doing something special?" band ─────────────────── */}
      {page.specialBand && (
        <section className="bg-cream mt-16 px-6 py-12 text-center md:mt-20 md:px-10">
          <div className="mx-auto max-w-[620px]">
            <SitePhoto
              photo={page.specialBand.illustration}
              fit="contain"
              sizes="150px"
              className="mx-auto h-[130px] w-[150px]"
            />
            <h2 className="t-h-lg text-headline mt-4">
              {page.specialBand.heading}
            </h2>
            <p className="t-body-lg text-body mt-3 md:text-base md:leading-7">
              {page.specialBand.body}
            </p>
          </div>
        </section>
      )}

      {/* ── What you'll make ──────────────────────────────────────────────── */}
      <section className="pt-16 md:pt-24">
        <div className="px-6 text-center md:px-10">
          <h2 className="t-h-xl text-headline">{page.makeHeading}</h2>
          <p className="t-body-sm text-body mt-3">{page.makeSubhead}</p>
        </div>
        <div
          className="mt-8 flex gap-4 overflow-x-auto px-6 md:justify-center md:px-10 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {page.makePhotos.map((p) => (
            <SitePhoto
              key={p.src}
              photo={p}
              sizes="330px"
              className="aspect-[3/4] w-[330px] shrink-0"
            />
          ))}
        </div>
      </section>

      {/* ── Details ───────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 md:px-10 md:pt-24">
        <div className="mx-auto max-w-[760px]">
          <h2 className="t-h-xl text-headline text-center">
            {page.detailsHeading}
          </h2>
          {page.detailsEyebrow && (
            <p className="t-eyebrow text-details mt-2 text-center">
              {page.detailsEyebrow}
            </p>
          )}

          <div className="mt-10">
            {page.details.map((row) => (
              <DetailBlock key={row.label} row={row} />
            ))}
          </div>

          {/* What's included */}
          <h3 className="t-body-lg-bold text-headline mt-10 md:text-base">
            What’s included?
          </h3>
          <ul className="mt-4 flex flex-col gap-4">
            {page.included.map((item) => (
              <li key={item.text} className="flex items-start gap-4">
                <CheckIcon className="text-rust mt-1 size-5 shrink-0" />
                <span className="t-body-lg text-body md:text-base md:leading-7">
                  {item.text}
                </span>
                {item.hasInfo && (
                  <InfoIcon className="text-headline mt-1 size-5 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Drop-in: "Planning for a group?" ──────────────────────────────── */}
      {page.groupCta && (
        <section className="px-6 pt-20 text-center md:px-10">
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
            <Button
              href={page.groupCta.href}
              className="mt-7 hidden md:inline-flex md:min-w-[320px]"
            >
              {page.groupCta.cta}
            </Button>
          </div>
        </section>
      )}

      {/* ── Instructors ───────────────────────────────────────────────────── */}
      <section className="bg-cream mt-20 py-14 md:py-20">
        <h2 className="t-h-xl text-headline px-6 pb-8 text-center md:px-10 md:pb-12">
          Our instructors
        </h2>
        <InstructorRail
          cards={INSTRUCTORS.map((i) => ({
            key: i.name,
            instructor: i,
            photo: (
              <SitePhoto photo={i.photo} sizes="264px" className="aspect-[3/4] w-full" />
            ),
          }))}
        />
      </section>

      {/* ── Reviews ───────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 md:px-10 md:pt-24">
        <div className="mx-auto max-w-[760px]">
          <h2 className="t-h-xl text-headline mb-10 text-center">Reviews</h2>

          <div className="flex flex-col gap-12">
            {CLASS_REVIEWS.map((r, i) => (
              <article key={i}>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sage flex gap-1" aria-label={`${r.rating} out of 5`}>
                    {Array.from({ length: r.rating }).map((_, s) => (
                      <Star key={s} className="size-5" />
                    ))}
                  </div>
                  <span className="t-body-sm text-details">{r.when}</span>
                </div>
                <h3 className="t-body-lg-bold text-headline mt-3 md:text-base">
                  {r.title}
                </h3>
                <p className="t-body-lg text-details md:text-base">{r.name}</p>
                <p className="t-body-lg text-body mt-4 md:text-base md:leading-7">
                  {r.body}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div
          className="mt-10 flex gap-4 overflow-x-auto md:mx-auto md:max-w-[760px] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {REVIEW_PHOTOS.map((p) => (
            <SitePhoto
              key={p.src}
              photo={p}
              sizes="180px"
              className="aspect-square w-[180px] shrink-0 rounded-2xl"
            />
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-[760px]">
          <Button href="/community" variant="secondary" block>
            See more
          </Button>
        </div>
      </section>

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 md:px-10 md:pt-24">
        <div className="mx-auto max-w-[760px]">
          <SitePhoto
            photo={{
              src: '/site/illo-pot-faq.svg',
              alt: 'A pottery character holding a list',
            }}
            fit="contain"
            sizes="200px"
            className="mx-auto h-[190px] w-[200px]"
          />
          <h2 className="t-h-xl text-headline mt-4 mb-6 text-center">FAQ’s</h2>
          <FaqList faqs={page.faqs} />
        </div>
      </section>

      {/* ── Product row ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4 px-6 py-20 md:mx-auto md:max-w-[900px] md:px-10">
        {PRODUCT_ROW.map((p) => (
          <SitePhoto
            key={p.src}
            photo={p}
            fit="contain"
            sizes="33vw"
            className="aspect-square w-full"
          />
        ))}
      </section>

      {/* ── Sticky book bar ───────────────────────────────────────────────────
          Pinned over the page at the foot of every class design. Being fixed it
          is out of flow, so it would otherwise sit over the last 88px of the
          footer once scrolled to the bottom. The marker below is picked up by a
          `body:has([data-sticky-cta]) footer` rule in globals.css, which pads
          the footer by the bar's height — the footer lives in the layout, so it
          can't be reached from here any other way. */}
      <div data-sticky-cta hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 pb-5">
        <div className="pointer-events-auto mx-auto max-w-[760px]">
          <Button href={page.bookHref} block className="shadow-lg">
            {page.bookCta}
          </Button>
        </div>
      </div>
    </>
  );
}
