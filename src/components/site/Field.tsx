'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The text field from the account design files: a pill-cornered box with a
 * sage-stroke border. The label sits inside as the placeholder while the
 * field is empty and floats up onto the border once there is a value or
 * focus ("First name" above "Sydney"). An error prints under the box in red
 * ("Invalid email address").
 */
export function Field({
  label,
  error,
  className,
  id: idProp,
  ...input
}: {
  label: string;
  error?: string | null;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder' | 'className'>) {
  const generated = useId();
  const id = idProp ?? generated;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'peer h-14 w-full rounded-2xl border bg-white px-5 text-base text-headline outline-none transition-colors',
            'focus:border-sage',
            error ? 'border-[#ff2d55]' : 'border-sage-stroke',
          )}
          {...input}
        />
        <label
          htmlFor={id}
          className={cn(
            'text-body pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 bg-white px-1 text-base transition-all',
            'peer-focus:top-0 peer-focus:text-sm',
            'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-sm',
          )}
        >
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="mt-2 ml-5 text-sm text-[#ff2d55]">
          {error}
        </p>
      )}
    </div>
  );
}
