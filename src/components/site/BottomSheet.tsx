'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The edit sheet from the "My account" design files: slides up from the foot
 * of the phone over a dimmed page, with a grab handle, a serif title and the
 * form underneath. On a desktop window the same panel sits in the middle of
 * the screen instead, since a sheet pinned to the bottom of a tall window
 * reads as broken.
 *
 * Closes on the scrim, the Escape key, or `onClose` from inside (after a
 * save). Page scroll is locked while it is open.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Land focus on the first field so the keyboard comes up straight away.
    const first = panelRef.current?.querySelector<HTMLElement>('input, button, textarea, select');
    first?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'animate-sheet-up relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-white px-6 pt-3 pb-10',
          'md:max-w-md md:rounded-[32px] md:px-8 md:pt-8 md:pb-8',
          className,
        )}
      >
        <div aria-hidden className="bg-fill mx-auto mb-7 h-1 w-12 rounded-full md:hidden" />
        <h2 id={titleId} className="t-h-xl text-headline mb-8">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
