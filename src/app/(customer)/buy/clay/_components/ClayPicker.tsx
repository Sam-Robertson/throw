'use client';

import { useState } from 'react';
import { Button } from '@/components/site/Button';
import { CheckIcon } from '@/components/site/icons';
import { cn } from '@/lib/utils';

type Product = { id: string; name: string; priceCents: number; photo: React.ReactNode };

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function ClayPicker({ products }: { products: Product[] }) {
  const [picked, setPicked] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/shop/clay/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: picked }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? 'Could not start checkout. Please try again.');
    setBusy(false);
  }

  return (
    <>
      <div role="radiogroup" className="mt-8 flex flex-col gap-6">
        {products.map((p) => {
          const on = picked === p.id;
          return (
            <label key={p.id} className="flex cursor-pointer items-center gap-4">
              <input
                type="radio"
                name="clay"
                value={p.id}
                checked={on}
                onChange={() => setPicked(p.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                  'peer-focus-visible:outline-sage peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                  on ? 'border-sage bg-sage text-white' : 'border-sage bg-white text-transparent',
                )}
              >
                <CheckIcon className="size-4" />
              </span>
              {p.photo}
              <span>
                <span className="t-body-sm-bold text-headline block">{p.name}</span>
                <span className="text-body block text-[14px] leading-5">{money(p.priceCents)}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[14px] leading-5 text-[#ff2d55]">{error}</p>}

      <div className="sticky bottom-0 mt-auto bg-white pt-8 pb-4">
        <Button block disabled={!picked || busy} onClick={buy}>
          {busy ? 'One moment…' : 'Buy clay'}
        </Button>
      </div>
    </>
  );
}
