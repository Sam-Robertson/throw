'use client';

import { cn } from '@/lib/utils';
import { CheckIcon } from './icons';

/**
 * The checkbox from the "Pausing your membership" design: a sage-outlined
 * square that fills sage with a white tick when checked, label to the right.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sage',
          checked ? 'border-sage bg-sage text-white' : 'border-sage bg-white text-transparent',
        )}
      >
        <CheckIcon className="size-4" />
      </span>
      <span className="t-body-sm text-body">{children}</span>
    </label>
  );
}
