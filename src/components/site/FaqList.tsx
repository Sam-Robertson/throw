'use client';

import { useState } from 'react';
import type { Faq } from '@/content/classes';

/**
 * FAQ accordion. The designs draw the first row open with a rust minus, the
 * rest closed with a rust plus, and a hairline rule under every row.
 */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="border-fill border-b">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-6 py-5 text-left"
              >
                <span className="t-body-lg-bold text-headline md:text-base">
                  {f.q}
                </span>
                <span
                  aria-hidden
                  className="text-rust relative size-5 shrink-0"
                >
                  {/* Horizontal stroke is always drawn; the vertical one is
                      hidden when open, turning the plus into a minus. */}
                  <span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 bg-current" />
                  {!isOpen && (
                    <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-current" />
                  )}
                </span>
              </button>
            </h3>
            {isOpen && (
              <p className="t-body-lg text-body pb-6 pl-4 md:pl-0 md:text-base md:leading-7">
                {f.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
