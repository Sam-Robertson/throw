'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

type Item = { key: string; node: React.ReactNode };

/**
 * Edge-to-edge horizontal strip of photos with ← → arrows under it on the
 * right, as the class pages draw "What you'll make" (Oct 2026 design). Scrolls
 * one tile at a time; swiping works too. Tiles are passed in pre-rendered
 * because <SitePhoto> reads the filesystem and has to stay server-side.
 */
export function PhotoCarousel({
  items,
  tileClassName,
  className,
}: {
  items: Item[];
  /** Width + aspect of each tile, e.g. "w-[80vw] md:w-[510px] aspect-[17/15]". */
  tileClassName: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function step(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const tile = el.firstElementChild as HTMLElement | null;
    const by = tile ? tile.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * by, behavior: 'smooth' });
  }

  return (
    <div className={className}>
      <div
        ref={trackRef}
        className="flex snap-x gap-4 overflow-x-auto px-6 md:px-10 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((it) => (
          <div key={it.key} className={cn('shrink-0 snap-start', tileClassName)}>
            {it.node}
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-5 px-6 md:px-10">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous photos"
          className="text-headline hover:text-sage flex size-8 items-center justify-center transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next photos"
          className="text-headline hover:text-sage flex size-8 items-center justify-center transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
