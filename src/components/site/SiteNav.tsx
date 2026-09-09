'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import type { Role } from '@prisma/client';
import { ANNOUNCEMENT, NAV_LINKS } from '@/content/site';
import { Asterisk } from './icons';

type NavUser = { name?: string | null; role: Role };

/**
 * Marketing header — announcement bar + nav.
 *
 * Mobile (per Home.png): mascot left, hamburger right; the open menu is a full
 * white sheet with serif links and a close X, sliding over a sliver of page.
 * Desktop (per Desktop.png): wordmark left, six serif links right, no CTA and
 * no elevation.
 *
 * NOTE — the designs draw no Sign in / My account entry point anywhere in the
 * nav. Removing it outright would strand signed-in customers with no route to
 * /dashboard or /bookings, so the account links are kept at the foot of the
 * mobile sheet and behind a small desktop link. Flagged for the designer.
 */
const ACCOUNT_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bookings', label: 'My bookings' },
  { href: '/account', label: 'Account settings' },
];

export function SiteNav({ user }: { user: NavUser | null }) {
  const [open, setOpen] = useState(false);
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header>
      <div className="bg-white">
        <div className="mx-auto flex h-[68px] w-full max-w-[1568px] items-center justify-between px-6 md:h-20 md:px-10">
          {/* Wordmark — mascot alone on mobile, full lockup on desktop. */}
          <NextLink href="/" className="flex items-center" aria-label="Throw — home">
            <Image
              src="/mascot.png"
              alt=""
              width={217}
              height={217}
              priority
              className="h-11 w-auto md:hidden"
            />
            <Image
              src="/logo.png"
              alt="Throw"
              width={670}
              height={185}
              priority
              className="hidden h-9 w-auto md:block"
            />
          </NextLink>

          {/* Desktop links */}
          <nav className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((l) => (
              <NextLink
                key={l.href}
                href={l.href}
                className="text-headline hover:text-sage font-serif text-[17px] transition-colors"
              >
                {l.label}
              </NextLink>
            ))}
            {user ? (
              <NextLink
                href="/dashboard"
                className="text-body hover:text-headline font-serif text-[17px] transition-colors"
              >
                My account
              </NextLink>
            ) : (
              <NextLink
                href="/login"
                className="text-body hover:text-headline font-serif text-[17px] transition-colors"
              >
                Sign in
              </NextLink>
            )}
          </nav>

          {/* Hamburger — mobile */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-11 items-center justify-center md:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
              <path
                d="M3 6h18M3 12h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Announcement bar */}
      <div className="bg-sage text-white">
        <div className="flex items-center justify-center gap-6 px-6 py-3 md:py-2.5">
          <Asterisk className="size-4 shrink-0" />
          <p className="t-body-sm-bold text-center md:text-[15px]">{ANNOUNCEMENT}</p>
          <Asterisk className="size-4 shrink-0" />
        </div>
      </div>

      {/* ── Mobile menu sheet ────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/20"
          />
          {/* The design leaves a narrow strip of the page visible on the left. */}
          <div className="absolute inset-y-0 right-0 flex w-[82%] flex-col overflow-y-auto bg-white">
            <div className="flex justify-end px-6 pt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-11 items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
                  <path
                    d="M5 5l14 14M19 5L5 19"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-7 px-8 pt-8 pb-10">
              {NAV_LINKS.map((l) => (
                <NextLink
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-headline font-serif text-[28px] leading-none"
                >
                  {l.label}
                </NextLink>
              ))}
            </nav>

            {/* Account block — not in the design; see note at the top. */}
            <div className="border-fill mt-auto flex flex-col gap-4 border-t px-8 py-8">
              {user ? (
                <>
                  {ACCOUNT_LINKS.map((l) => (
                    <NextLink
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="t-body-sm-bold text-body"
                    >
                      {l.label}
                    </NextLink>
                  ))}
                  {isStaffOrAdmin && (
                    <NextLink
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="t-body-sm-bold text-body"
                    >
                      Admin panel
                    </NextLink>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void signOut({ callbackUrl: '/' });
                    }}
                    className="t-body-sm-bold text-rust text-left"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <NextLink
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="t-body-sm-bold text-body"
                >
                  Sign in
                </NextLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
