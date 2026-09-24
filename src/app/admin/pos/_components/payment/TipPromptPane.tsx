'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tipBaseCents, tipOptions } from '@/lib/tipping';
import { apiErrorMessage, formatMoney, type ApiErrorBody, type PosOrder } from '../types';
import { JSON_HEADERS } from './paneTypes';

/**
 * The customer-facing tip screen. Shown once per order, before a tender that
 * has no tip screen of its own (typed-in card, gift card, account credit) —
 * the card reader asks on its own display instead. Turn the screen to the
 * customer; the small Skip link at the bottom is for staff.
 */
export function TipPromptPane({
  order,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  order: PosOrder;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  /** Called with the updated order once a tip (or no tip) is saved, or with null on Skip. */
  onDone: (order: PosOrder | null) => void;
}) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const base = tipBaseCents(order);
  const options = tipOptions(base);

  async function choose(tipCents: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${order.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ tipCents }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as ApiErrorBody) : {};
      setError(apiErrorMessage(data, 'Could not save the tip'));
      return;
    }
    onDone((await res.json()) as PosOrder);
  }

  function submitCustom() {
    const dollars = parseFloat(custom);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    void choose(Math.round(dollars * 100));
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="text-center">
        <p className="text-2xl font-semibold">Would you like to leave a tip?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tips go to the studio team. Your total so far is {formatMoney(order.totalCents)}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <Button
            key={opt.label}
            className="flex h-auto min-h-20 flex-col gap-0.5 text-xl font-semibold"
            onClick={() => void choose(opt.amountCents)}
            disabled={busy}
          >
            <span>{opt.label}</span>
            <span className="text-sm font-normal opacity-90">{formatMoney(opt.amountCents)}</span>
          </Button>
        ))}
      </div>

      {showCustom ? (
        <div className="flex items-center gap-2">
          <span className="text-lg">$</span>
          <Input
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCustom();
            }}
            className="min-h-14 text-xl"
          />
          <Button className="min-h-14 px-6 text-base" onClick={submitCustom} disabled={busy || !custom}>
            Add
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-14 text-base" onClick={() => setShowCustom(true)} disabled={busy}>
            Custom amount
          </Button>
          <Button variant="outline" className="min-h-14 text-base" onClick={() => void choose(0)} disabled={busy}>
            No tip
          </Button>
        </div>
      )}

      <button
        type="button"
        className="self-center text-xs text-muted-foreground underline underline-offset-4"
        onClick={() => onDone(null)}
        disabled={busy}
      >
        Skip (staff)
      </button>
    </div>
  );
}
