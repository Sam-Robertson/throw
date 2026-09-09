import NextLink from 'next/link';
import { CONTACT, FOOTER_COLUMNS } from '@/content/site';
import { FacebookIcon, InstagramIcon, TikTokIcon } from './icons';

/**
 * Sage footer.
 *
 * Section headings are GT Alpina in a pale sage tint; links are Satoshi bold in
 * white. Mobile stacks Learn / About us / Connect / Other in a single column;
 * desktop puts the wordmark on the left and four columns on the right in the
 * order Learn / Connect / About us / Other — both taken from their own design.
 *
 * The four class-page designs show an older footer (uppercase Satoshi headings,
 * a "throw." wordmark with a period). Confirmed with the client that the Home
 * version shown here is the current one, so it is used site-wide.
 */

const CONNECT_HEADING = 'Connect';

export function SiteFooter() {
  const [learn, about, other] = FOOTER_COLUMNS;

  return (
    <footer className="bg-sage text-white">
      <div className="mx-auto w-full max-w-[1568px] px-6 py-14 md:px-10 md:py-20">
        {/* Wordmark. The design uses a swashy white "throw" logotype; until that
            SVG arrives this is the serif wordmark at the same weight/size. */}
        <NextLink
          href="/"
          className="mb-14 inline-block font-serif text-[44px] leading-none md:mb-0 md:text-[56px]"
        >
          throw
        </NextLink>

        <div className="md:-mt-16 md:flex md:justify-end">
          <div className="flex flex-col gap-12 md:grid md:grid-cols-4 md:gap-x-12 md:gap-y-0">
            <FooterColumn heading={learn.heading} links={learn.links} />

            {/* Connect — mobile draws it third, desktop second. */}
            <div className="order-3 md:order-none">
              <h2 className="mb-6 font-serif text-[28px] leading-none text-white/45">
                {CONNECT_HEADING}
              </h2>
              <div className="flex flex-col gap-5">
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="t-body-sm-bold transition-opacity hover:opacity-70"
                >
                  {CONTACT.email}
                </a>
                <a
                  href={CONTACT.phoneHref}
                  className="t-body-sm-bold transition-opacity hover:opacity-70"
                >
                  {CONTACT.phone}
                </a>
                <div className="flex items-center gap-5">
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

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="mb-6 font-serif text-[28px] leading-none text-white/45">
        {heading}
      </h2>
      <div className="flex flex-col gap-5">
        {links.map((l) => (
          <NextLink
            key={l.href}
            href={l.href}
            className="t-body-sm-bold transition-opacity hover:opacity-70"
          >
            {l.label}
          </NextLink>
        ))}
      </div>
    </div>
  );
}
