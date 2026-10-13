'use client';

import { useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { signOut } from 'next-auth/react';
import type { Role } from '@prisma/client';
import { ANNOUNCEMENT, KIDS_CAMPS_MENU, NAV_LINKS } from '@/content/site';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Logo, Wordmark } from './Logo';

type NavUser = { name?: string | null; role: Role };

/**
 * Marketing header — nav + announcement bar, to the Navigation design
 * (Oct 2026).
 *
 * Desktop: the "throw" + mascot lockup left, five Satoshi links (no Calendar),
 * a green Sign in pill right. A hovered link sits on a cream pill. Kids camps
 * opens a dropdown with one column per studio. The header is static.
 *
 * Mobile: the wordmark left, a black hamburger right, a short announcement
 * bar with no asterisks. The whole header slides away as the page scrolls
 * down and comes back as soon as it scrolls up. The open menu is a white sheet
 * with Satoshi links and a green Sign in pill under them.
 *
 * Signed-in customers still need a way to their account: "My account" takes
 * the Sign in pill's place, and the mobile sheet lists the account pages
 * under it.
 */
const ACCOUNT_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bookings', label: 'My bookings' },
  { href: '/account', label: 'Account settings' },
];

const DROPDOWN_LABEL = 'Kids camps';

const LINK_CLASS =
  'text-headline hover:bg-cream focus-visible:bg-cream rounded-full px-3.5 py-2 text-[15px] leading-none font-medium transition-colors outline-none';

export function SiteNav({ user }: { user: NavUser | null }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';

  // Hide on scroll down, show on scroll up (mobile only — the header is
  // static from md up, see the className below). A small threshold keeps it
  // from flickering on tiny scroll jitters and near the top of the page.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y <= 8) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close the sheet and the dropdown on Escape.
  useEffect(() => {
    if (!open && !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, menuOpen]);

  // The dropdown stays open while the pointer moves from the link down into
  // the panel; a short grace period covers the gap between them.
  function showMenu() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMenuOpen(true);
  }
  function hideMenu() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 120);
  }

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 transition-transform duration-300 ease-out md:static md:translate-y-0',
          hidden && !open && 'max-md:-translate-y-full',
        )}
      >
        <div className="bg-white">
          <div className="mx-auto flex h-[60px] w-full max-w-[1568px] items-center justify-between px-6 md:h-20 md:px-10">
            {/* Wordmark alone on mobile; wordmark + waving mascot on desktop. */}
            <NextLink
              href="/"
              className="text-headline flex items-center"
              aria-label="Throw — home"
            >
              <Wordmark className="h-7 w-auto md:hidden" />
              <Logo className="hidden h-10 w-auto md:block" />
            </NextLink>

            {/* Desktop links + Sign in pill */}
            <nav className="hidden items-center gap-3 md:flex">
              {NAV_LINKS.map((l) =>
                l.label === DROPDOWN_LABEL ? (
                  <div
                    key={l.label}
                    className="relative"
                    onMouseEnter={showMenu}
                    onMouseLeave={hideMenu}
                    onFocus={showMenu}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hideMenu();
                    }}
                  >
                    <NextLink
                      href={l.href}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      className={cn(LINK_CLASS, 'inline-block', menuOpen && 'bg-cream')}
                    >
                      {l.label}
                    </NextLink>

                    {/* Dropdown: one column per studio, as drawn in the
                        Navigation design. */}
                    <div
                      role="menu"
                      aria-label="Kids camps"
                      className={cn(
                        'absolute top-full left-0 z-50 mt-3 flex gap-10 rounded-2xl bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-opacity duration-150',
                        menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
                      )}
                    >
                      {KIDS_CAMPS_MENU.map((col) => (
                        <div key={col.studio} className="flex min-w-[120px] flex-col">
                          <p className="text-details mb-3 text-[11px] leading-4 font-bold tracking-[0.14em] uppercase">
                            {col.studio}
                          </p>
                          <div className="flex flex-col gap-3">
                            {col.items.map((item) => (
                              <NextLink
                                key={item.label}
                                href={item.href}
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                                className="text-headline hover:text-sage text-[14px] leading-5 font-medium whitespace-nowrap transition-colors"
                              >
                                {item.label}
                              </NextLink>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NextLink key={l.label} href={l.href} className={LINK_CLASS}>
                    {l.label}
                  </NextLink>
                ),
              )}
              {isStaffOrAdmin && (
                <NextLink href="/admin" className={cn(LINK_CLASS, 'ml-2')}>
                  Admin
                </NextLink>
              )}
              <Button
                href={user ? '/dashboard' : '/login'}
                className="ml-5 h-10 px-6 text-[15px] md:h-10"
              >
                {user ? 'My account' : 'Sign in'}
              </Button>
            </nav>

            {/* Hamburger — mobile, pure black */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="-mr-2 flex size-11 items-center justify-center text-black md:hidden"
            >
              <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
                <path
                  d="M3 6h18M3 12h18M3 18h18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Announcement bar — short, no asterisks */}
        <div className="bg-sage text-white">
          <p className="t-body-sm-bold px-6 py-[7px] text-center text-[15px] leading-6 md:py-1.5">
            {ANNOUNCEMENT}
          </p>
        </div>
      </header>

      {/* ── Mobile menu sheet ────────────────────────────────────────────── */}
      {/* A sibling of the header, not a child: the header slides with a
          transform, and a transformed ancestor would turn this fixed sheet
          into one clipped to the header's own box. */}
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
            <div className="flex justify-end px-5 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-11 items-center justify-center text-black"
              >
                <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
                  <path
                    d="M5 5l14 14M19 5L5 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col items-start gap-7 px-8 pt-6 pb-10">
              {NAV_LINKS.map((l) => (
                <NextLink
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-headline text-[20px] leading-none font-medium"
                >
                  {l.label}
                </NextLink>
              ))}

              <Button
                href={user ? '/dashboard' : '/login'}
                onClick={() => setOpen(false)}
                className="mt-1 h-11 px-7 text-[15px]"
              >
                {user ? 'My account' : 'Sign in'}
              </Button>
            </nav>

            {user && (
              <div className="border-fill mt-auto flex flex-col gap-4 border-t px-8 py-8">
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
