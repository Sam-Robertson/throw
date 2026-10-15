import NextLink from 'next/link';
import { CONTACT, FOOTER_COLUMNS, TAGLINE } from '@/content/site';
import { FacebookIcon, InstagramIcon, TikTokIcon } from './icons';

/**
 * Sage footer, to the designer's Oct 2026 review.
 *
 * Section headings are small uppercase letter-spaced Satoshi bold in white;
 * links are Satoshi regular in white (the 2026-10-15 desktop file). Mobile stacks Learn / About us / Connect /
 * Other in a single column under the tagline; desktop puts the tagline on
 * the left and four columns on the right in the order Learn / Connect / About
 * us / Other.
 */

const CONNECT_HEADING = 'Connect';

export function SiteFooter() {
  const [learn, about, other] = FOOTER_COLUMNS;

  return (
    <footer className="bg-sage text-white">
      <div className="mx-auto w-full max-w-[1568px] px-6 py-12 md:px-10 md:py-16">
        {/* The designer's 2026-10-15 desktop file puts the studio's line here
            instead of the wordmark. */}
        <p className="t-eyebrow mb-12 md:mb-0">{TAGLINE}</p>

        <div className="md:-mt-14 md:flex md:justify-end">
          <div className="flex flex-col gap-11 md:grid md:grid-cols-[auto_auto_auto_auto] md:gap-x-14 md:gap-y-0">
            <FooterColumn heading={learn.heading} links={learn.links} />

            {/* Connect — mobile draws it third, desktop second. */}
            <div className="order-3 md:order-none">
              <FooterHeading>{CONNECT_HEADING}</FooterHeading>
              <div className="flex flex-col gap-4">
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="t-body-sm transition-opacity hover:opacity-70"
                >
                  {CONTACT.email}
                </a>
                <a
                  href={CONTACT.phoneHref}
                  className="t-body-sm transition-opacity hover:opacity-70"
                >
                  {CONTACT.phone}
                </a>
                <div className="flex items-center gap-5 pt-1">
                  <a href={CONTACT.facebook} aria-label="Throw on Facebook">
                    <FacebookIcon className="size-7 transition-opacity hover:opacity-70" />
                  </a>
                  <a href={CONTACT.instagram} aria-label="Throw on Instagram">
                    <InstagramIcon className="size-7 transition-opacity hover:opacity-70" />
                  </a>
                  <a href={CONTACT.tiktok} aria-label="Throw on TikTok">
                    <TikTokIcon className="size-7 transition-opacity hover:opacity-70" />
                  </a>
                </div>
              </div>
            </div>

            <div className="order-2 md:order-none">
              <FooterColumn heading={about.heading} links={about.links} />
            </div>
            <div className="order-4 md:order-none">
              <FooterColumn heading={other.heading} links={other.links} />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="t-eyebrow mb-5 text-white">{children}</h2>;
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { href: string | null; label: string }[];
}) {
  return (
    <div>
      <FooterHeading>{heading}</FooterHeading>
      <div className="flex flex-col gap-4">
        {links.map((l) =>
          l.href ? (
            <NextLink
              key={l.label}
              href={l.href}
              className="t-body-sm transition-opacity hover:opacity-70"
            >
              {l.label}
            </NextLink>
          ) : (
            // A dead entry: listed, goes nowhere yet (Gift cards).
            <span key={l.label} className="t-body-sm">
              {l.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
