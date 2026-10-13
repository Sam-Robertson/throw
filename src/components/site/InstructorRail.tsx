'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Instructor } from '@/content/site';

type Card = { key: string; instructor: Instructor; photo: React.ReactNode };

/**
 * Horizontally-scrolling rail of instructor polaroids — white card, photo
 * inset, serif name underneath. Nothing else: the Oct 2026 review removed the
 * "N yrs experience" line.
 *
 * On desktop, hovering (or focusing) a card lays "<Name> teaches" and a "Fun
 * fact" over the photo, top-left aligned. The card keeps its size and the name
 * stays exactly where it was, whichever face is showing — both asked for in
 * the review. Touch devices get no reveal (no hover), so the card stays a plain
 * polaroid on mobile, as drawn.
 */
export function InstructorRail({ cards }: { cards: Card[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div
      className="flex gap-4 overflow-x-auto px-6 pt-2 pb-8 md:gap-8 md:px-10 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {cards.map(({ key, instructor, photo }) => {
        const open = openKey === key;
        return (
          <article
            key={key}
            onMouseEnter={() => setOpenKey(key)}
            onMouseLeave={() => setOpenKey((k) => (k === key ? null : k))}
            onFocus={() => setOpenKey(key)}
            onBlur={() => setOpenKey((k) => (k === key ? null : k))}
            tabIndex={0}
            className={cn(
              'flex w-[228px] shrink-0 flex-col bg-white p-4 pb-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]',
              'focus-visible:outline-sage focus-visible:outline-2 md:w-[292px] md:p-6 md:pb-6',
            )}
          >
            {/* The photo always renders so the box never changes height; the
                facts are laid over it rather than replacing it. */}
            <div className="relative aspect-[3/4] w-full">
              {photo}
              <div
                aria-hidden={!open}
                className={cn(
                  'absolute inset-0 hidden flex-col bg-white px-1 pt-10 text-left md:flex',
                  open ? 'opacity-100' : 'pointer-events-none opacity-0',
                  'transition-opacity duration-150',
                )}
              >
                <p className="t-body-sm-bold text-headline">{instructor.name} teaches</p>
                {instructor.teaches.map((t) => (
                  <p key={t} className="t-body-sm text-body">
                    {t}
                  </p>
                ))}
                <p className="t-body-sm-bold text-headline mt-6">Fun fact</p>
                <p className="t-body-sm text-body">{instructor.funFact}</p>
              </div>
            </div>

            <h3 className="text-headline mt-4 text-center font-serif text-[28px] leading-none md:mt-5 md:text-[44px]">
              {instructor.name}
            </h3>
          </article>
        );
      })}
    </div>
  );
}
