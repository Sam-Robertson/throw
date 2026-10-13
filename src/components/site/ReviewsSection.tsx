import NextLink from 'next/link';
import { SitePhoto } from './SitePhoto';
import { Star } from './icons';
import { CLASS_REVIEWS, REVIEW_PHOTOS } from '@/content/classes';

/**
 * The reviews block the class pages and the Memberships page share (Oct 2026
 * designs): a 700px column of reviews — sage stars, date on the right, bold
 * title, grey reviewer, body — a row of photos under the last one, and a
 * "More reviews ⌄" link. The three reviews are the sample the designs repeat;
 * see src/content/classes.ts.
 */
export function ReviewsSection({ className }: { className?: string }) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-[700px] px-6 md:px-0">
        <h2 className="t-h-xl text-headline mb-10 text-center">Reviews</h2>

        <div className="flex flex-col gap-12">
          {CLASS_REVIEWS.map((r, i) => (
            <article key={i}>
              <div className="flex items-center justify-between gap-4">
                <div className="text-sage flex gap-1" aria-label={`${r.rating} out of 5`}>
                  {Array.from({ length: r.rating }).map((_, s) => (
                    <Star key={s} className="size-4" />
                  ))}
                </div>
                <span className="text-details text-[14px] leading-5">{r.when}</span>
              </div>
              <h3 className="t-body-lg-bold text-headline mt-3 md:text-base">{r.title}</h3>
              <p className="text-details text-[15px] leading-6">{r.name}</p>
              <p className="t-body-lg text-body mt-4 md:text-base md:leading-7">{r.body}</p>
            </article>
          ))}
        </div>

        <div
          className="mt-8 flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {REVIEW_PHOTOS.map((p) => (
            <SitePhoto
              key={p.src}
              photo={p}
              sizes="150px"
              className="bg-fill aspect-[150/215] w-[150px] shrink-0 rounded-xl"
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <NextLink
            href="/community"
            className="t-body-sm-bold text-headline hover:text-sage inline-flex items-center gap-2 transition-colors"
          >
            More reviews
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </NextLink>
        </div>
      </div>
    </section>
  );
}
