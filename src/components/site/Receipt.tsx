import { Button } from './Button';
import { CheckCircleIcon } from './icons';

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/**
 * The "Paid for firing — Thank you!" page from the portal design, shared by
 * the clay and firing purchases: a tick, what was paid for, the order
 * summary, the total, a confirmation number and Done.
 */
export function Receipt({
  eyebrow,
  heading,
  note,
  lines,
  taxCents,
  totalCents,
  confirmation,
}: {
  eyebrow: string;
  heading: string;
  note?: string;
  lines: { label: string; amount: number }[];
  taxCents: number;
  totalCents: number;
  confirmation: string;
}) {
  // Stripe's cs_… ids are long; the design shows a short "#TAS-20412".
  const short = `#TAS-${confirmation
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-6)
    .toUpperCase()}`;

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10 md:py-14">
      <div className="text-center">
        <CheckCircleIcon className="text-sage mx-auto size-7" />
        <p className="t-body-sm-bold text-headline mt-2">{eyebrow}</p>
        <h1 className="t-h-lg text-headline mt-1">{heading}</h1>
        {note && <p className="text-body mt-2 text-[14px] leading-5">{note}</p>}
      </div>

      <div className="mt-8">
        <p className="t-body-sm-bold text-headline">Order summary</p>
        <div className="mt-3 flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-body text-[14px] leading-5">{l.label}</span>
              <span className="text-body text-[14px] leading-5">{money(l.amount)}</span>
            </div>
          ))}
        </div>
        {taxCents > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-body text-[14px] leading-5">Taxes</span>
            <span className="text-body text-[14px] leading-5">{money(taxCents)}</span>
          </div>
        )}
        <div className="border-fill mt-4 flex items-center justify-between border-t pt-4">
          <span className="t-body-sm-bold text-headline">Total paid</span>
          <span className="t-body-sm-bold text-headline">{money(totalCents)}</span>
        </div>
        <p className="text-body mt-2 text-[13px] leading-5">Confirmation {short}</p>
      </div>

      <div className="mt-8">
        <Button href="/dashboard" block>
          Done
        </Button>
      </div>
    </div>
  );
}
