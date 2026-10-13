'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { ArrowRight, CopyIcon } from './icons';

/**
 * Location card (Oct 2026 review): a rounded white card with the studio photo
 * filling the top, then the studio name (Satoshi bold), the street address
 * with a copy-to-clipboard button, and a "See the space →" link. The hours and
 * the booking button the earlier design carried are gone.
 *
 * The photo is passed in pre-rendered because <SitePhoto> reads the
 * filesystem and so has to stay on the server side of the boundary.
 */
export function LocationCard({
  name,
  address,
  fullAddress,
  mapHref,
  href,
  photo,
  className,
}: {
  name: string;
  address: string;
  fullAddress: string;
  mapHref: string;
  href: string;
  photo: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused (insecure context, permissions); the
      // address is still on screen to select by hand.
    }
  }

  return (
    <article
      className={`border-fill flex flex-col overflow-hidden rounded-[28px] border bg-white ${className ?? ''}`}
    >
      {photo}

      <div className="flex flex-col items-center px-5 pt-6 pb-7 text-center md:pt-7 md:pb-8">
        <h3 className="text-headline text-[22px] leading-7 font-bold md:text-[26px] md:leading-8">
          {name}
        </h3>

        <p className="text-body mt-1.5 flex items-center justify-center gap-2 text-[15px] leading-6 md:mt-2 md:text-base">
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className="hover:text-headline transition-colors"
          >
            {address}
          </a>
          <button
            type="button"
            onClick={copyAddress}
            aria-label={copied ? 'Address copied' : 'Copy address'}
            title={copied ? 'Copied' : 'Copy address'}
            className="text-headline hover:text-sage flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            <CopyIcon className="size-[18px]" />
          </button>
        </p>

        <NextLink
          href={href}
          className="t-body-sm-bold text-headline hover:text-sage mt-4 inline-flex items-center gap-1.5 transition-colors md:mt-5"
        >
          See the space
          <ArrowRight className="size-5" />
        </NextLink>
      </div>
    </article>
  );
}
