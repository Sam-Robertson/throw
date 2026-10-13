import { cn } from '@/lib/utils';
import { CalendarIcon, CheckIcon, PinIcon } from './icons';

/**
 * The body of a class page in the portal: a status chip, the serif title,
 * "Member workshop | taught by JP", the date and address rows, the class
 * description and a "Good to know" list. Used by the booking page, My
 * classes' detail page and the confirmation.
 */
export const GOOD_TO_KNOW = [
  'Wear clothes that can get muddy. Aprons and tools provided',
  'We recommend you trim your nails before you come',
  'Arrive 10 minutes early so we can get you settled at a wheel',
];

export function StatusChip({
  tone,
  children,
}: {
  tone: 'sage' | 'rust' | 'grey';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] leading-4 font-bold',
        tone === 'sage' && 'border-sage-stroke bg-sage-fill text-sage',
        tone === 'rust' && 'border-rust/30 bg-rust/10 text-rust',
        tone === 'grey' && 'border-fill bg-cream text-body',
      )}
    >
      {tone === 'sage' && <CheckIcon className="size-3.5" />}
      {children}
    </span>
  );
}

export function SessionDetail({
  chip,
  title,
  kicker,
  instructor,
  when,
  address,
  mapHref,
  description,
  goodToKnow = GOOD_TO_KNOW,
  children,
}: {
  chip?: React.ReactNode;
  title: string;
  kicker: string;
  instructor?: string | null;
  when: string;
  address: string | null;
  mapHref?: string | null;
  description?: string | null;
  goodToKnow?: string[] | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      {chip && <div className="mb-3">{chip}</div>}
      <h1 className="t-h-lg text-headline">{title}</h1>
      <p className="text-body mt-1 text-[14px] leading-5">
        {kicker}
        {instructor ? ` | taught by ${instructor}` : ''}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <p className="text-body flex items-center gap-2 text-[14px] leading-5">
          <CalendarIcon className="text-headline size-4 shrink-0" />
          {when}
        </p>
        {address && (
          <p className="text-body flex items-center gap-2 text-[14px] leading-5">
            <PinIcon className="text-headline size-4 shrink-0" />
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {address}
              </a>
            ) : (
              address
            )}
          </p>
        )}
      </div>

      {description && <p className="text-body mt-5 text-[14px] leading-6">{description}</p>}

      {goodToKnow && goodToKnow.length > 0 && (
        <div className="mt-6">
          <h2 className="t-body-sm-bold text-headline">Good to know</h2>
          <ul className="text-body mt-2 list-disc pl-5 text-[14px] leading-6">
            {goodToKnow.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </div>
  );
}
