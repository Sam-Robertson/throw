"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { ANNOUNCEMENT, NAV_LINKS } from "@/content/site";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

type NavUser = { name?: string | null; role: Role };

/**
 * Marketing header — nav + announcement bar, to the designer's Oct 2026 review.
 *
 * Mobile: "throw" wordmark left, black hamburger right, a shorter announcement
 * bar with no asterisks. The whole header slides away as the page scrolls down
 * and comes back as soon as it scrolls up. The open menu is a white sheet with
 * Satoshi links and a green Sign in pill under them; Calendar is desktop-only.
 *
 * Desktop: wordmark + mascot lockup left, Satoshi links, a green Sign in pill
 * on the right. The header is static there.
 *
 * WORDMARK: the design uses the studio's swashy "throw" logotype, which has
 * not been supplied as an SVG; the serif wordmark stands in at the same size
 * until it arrives. The red "thr(mascot)w" lockup in /public/logo.png is not
 * what the design shows, so it is no longer used here.
 *
 * Signed-in customers still need a way to their account: "My account" takes
 * the Sign in pill's place, and the mobile sheet lists the account pages
 * under it.
 */
const ACCOUNT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "My bookings" },
  { href: "/account", label: "Account settings" },
];

const MOBILE_NAV_LINKS = NAV_LINKS.filter((l) => l.inMobileMenu);

function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-headline font-serif leading-none tracking-[-0.02em] select-none",
        className,
      )}
    >
      throw
    </span>
  );
}

export function SiteNav({ user }: { user: NavUser | null }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isStaffOrAdmin = user?.role === "STAFF" || user?.role === "ADMIN";

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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-transform duration-300 ease-out md:static md:translate-y-0",
          hidden && !open && "max-md:-translate-y-full",
        )}
      >
        <div className="bg-white">
          <div className="mx-auto flex h-[60px] w-full max-w-[1568px] items-center justify-between px-6 md:h-20 md:px-10">
            {/* Wordmark alone on mobile; wordmark + waving mascot on desktop. */}
            <NextLink href="/" className="flex items-center gap-1.5" aria-label="Throw — home">
              <Wordmark className="text-[30px] md:text-[36px]" />
              <Image
                src="/mascot.png"
                alt=""
                width={217}
                height={217}
                priority
                className="hidden h-9 w-auto md:block"
              />
            </NextLink>

            {/* Desktop links + Sign in pill */}
            <nav className="hidden items-center gap-9 md:flex">
              {NAV_LINKS.map((l) => (
                <NextLink
                  key={l.label}
                  href={l.href}
                  className="text-headline hover:text-sage text-[17px] leading-none font-medium transition-colors"
                >
                  {l.label}
                </NextLink>
              ))}
              <Button
                href={user ? "/dashboard" : "/login"}
                className="ml-2 h-10 px-6 text-[15px] md:h-10"
              >
                {user ? "My account" : "Sign in"}
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

        {/* Announcement bar — shorter than before, no asterisks */}
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
              {MOBILE_NAV_LINKS.map((l) => (
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
                href={user ? "/dashboard" : "/login"}
                onClick={() => setOpen(false)}
                className="mt-1 h-11 px-7 text-[15px]"
              >
                {user ? "My account" : "Sign in"}
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
                    void signOut({ callbackUrl: "/" });
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
