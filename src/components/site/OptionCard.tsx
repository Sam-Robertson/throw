'use client';

import { cn } from '@/lib/utils';

/**
 * The selectable option row from the design system sheet (the second "Buttons"
 * artboard). Drawn there as a two-item stack:
 *
 *   selected   — sage-fill surface, filled sage radio, black bold title,
 *                body-grey subhead
 *   unselected — white surface + sage-stroke border, hollow radio,
 *                black bold title, details-grey subhead
 *
 * Title and price sit on one row; the subhead sits under the title. Used by
 * the Date night page ("Shared wheel" / "A wheel each") and by checkout.
 */
export type Option = {
  id: string;
  label: string;
  subhead?: string;
  /** Pre-formatted, e.g. "$40.00" — the sheet shows "$XX.XX". */
  price?: string;
  disabled?: boolean;
};

type Props = {
  name: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function OptionCardGroup({
  name,
  options,
  value,
  onChange,
  className,
}: Props) {
  return (
    <div className={cn('flex flex-col gap-3', className)} role="radiogroup">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <label
            key={opt.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors',
              selected
                ? 'bg-sage-fill border border-transparent'
                : 'border-sage-stroke border bg-white',
              opt.disabled && 'pointer-events-none opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.id}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            {/* Radio mark — hollow sage ring, filled with a sage dot when on. */}
            <span
              aria-hidden
              className={cn(
                'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected
                  ? 'border-sage bg-white'
                  : 'border-sage bg-sage-fill',
              )}
            >
              {selected && <span className="bg-sage size-2.5 rounded-full" />}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="t-body-sm-bold text-headline">{opt.label}</span>
                {opt.price && (
                  <span className="t-body-sm-bold text-headline shrink-0">
                    {opt.price}
                  </span>
                )}
              </span>
              {opt.subhead && (
                <span
                  className={cn(
                    't-body-sm block',
                    selected ? 'text-body' : 'text-details',
                  )}
                >
                  {opt.subhead}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
