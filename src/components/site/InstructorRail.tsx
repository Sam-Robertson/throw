'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Instructor } from '@/content/site';

type Card = { key: string; instructor: Instructor; photo: React.ReactNode };

/**
 * Horizontally-scrolling rail of instructor polaroids — white card, photo
 * inset with a wide bottom margin, serif name, details-grey experience line.
 *
 * The desktop design draws one card in an expanded state: it grows and swaps
 * the photo for a "Teaches" list and a "Fun fact". That is built here as a
 * hover/focus reveal, since it can only be an interaction state — several cards
 * are drawn collapsed alongside it. Touch devices get no expand (no hover), so
 * the card stays a plain polaroid on mobile, as drawn.
 */
export function InstructorRail({ cards }: { cards: Card[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div
      className="flex gap-4 overflow-x-auto px-6 pt-2 pb-8 md:gap-6 md:px-10 [&::-webkit-scrollbar]:hidden"
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
              'flex w-[264px] shrink-0 flex-col bg-white p-3 pb-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]',
              'focus-visible:outline-sage transition-[width] duration-200 focus-visible:outline-2',
              open && 'md:w-[300px]',
            )}
          >
            {open ? (
              // Expanded face — text replaces the photo, name/experience stay.
              <div className="flex aspect-[3/4] flex-col justify-center px-3">
                <p className="t-body-sm-bold text-headline">Teaches</p>
                {instructor.teaches.map((t) => (
                  <p key={t} className="t-body-sm text-body">
                    {t}
                  </p>
                ))}
                <p className="t-body-sm-bold text-headline mt-5">Fun fact</p>
                <p className="t-body-sm text-body">{instructor.funFact}</p>
              </div>
            ) : (
              photo
            )}

            <h3 className="t-h-lg text-headline mt-4 text-center">
              {instructor.name}
            </h3>
            <p className="t-body-lg text-details text-center">
              {instructor.experience}
            </p>
          </article>
        );
      })}
    </div>
  );
}
