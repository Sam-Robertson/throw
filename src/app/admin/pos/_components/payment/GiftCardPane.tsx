'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGiftCardCode } from '@/lib/giftCardCode';
import { apiErrorMessage, formatMoney, type ApiErrorBody, type PosOrder } from '../types';
import { JSON_HEADERS, type PaneProps } from './paneTypes';

interface GiftCardLookup {
  id: string;
  code: string;
  balanceCents: number;
  usable: boolean;
  reason: string | null;
}

interface GiftCardPaneProps extends PaneProps {
  remaining: number;
  /** Cards already tied to the attached customer, offered as one-tap choices. */
  customerCards: { id: string; code: string; balanceCents: number }[];
}

/**
 * Gift card tender in two steps: look the card up and show its balance before
 * and after, then redeem. A card that doesn't cover the order is redeemed in
 * part and the sheet goes back to the tenders for the rest.
 */
export function GiftCardPane({
  orderId,
  remaining,
  customerCards,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
}: GiftCardPaneProps) {
  const [code, setCode] = useState('');
  const [card, setCard] = useState<GiftCardLookup | null>(null);

  async function lookup(typed: string) {
    if (!typed.trim()) return;
    setBusy(true);
    setError(null);
    setCard(null);
    const res = await fetch(`/api/pos/gift-cards/lookup?code=${encodeURIComponent(typed.trim())}`).catch(() => null);
    setBusy(false);
    if (!res) {
      setError('Could not reach the server. Check the connection and try again.');
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Could not find that gift card'));
      return;
    }
    setCard((await res.json()) as GiftCardLookup);
  }

  const applyCents = card ? Math.min(card.balanceCents, remaining) : 0;

  async function redeem() {
    if (!card || applyCents <= 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${orderId}/payments/gift-card`, {
      method: 'POST',
      headers: JSON_HEADERS,
      // The server clamps again to the order's balance and the card's own.
      body: JSON.stringify({ code: card.code, amountCents: applyCents }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError('Could not reach the server. Check the order before trying again.');
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Failed to apply gift card'));
      // The balance may have changed under us: show the fresh one.
      void lookup(card.code);
      return;
    }
    const data = (await res.json()) as {
      order: PosOrder;
      amountApplied: number;
      giftCardRemainingCents: number;
    };
    onResult(
      data.order,
      `Gift card took ${formatMoney(data.amountApplied)}. It has ${formatMoney(data.giftCardRemainingCents)} left.`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!card && (
        <>
          {customerCards.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">This customer&apos;s gift cards</p>
              {customerCards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCode(c.code);
                    void lookup(c.code);
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-left hover:bg-muted"
                >
                  <span className="font-mono">{formatGiftCardCode(c.code)}</span>
                  <span className="font-medium">{formatMoney(c.balanceCents)}</span>
                </button>
              ))}
            </div>
          )}
          <Label htmlFor="pos-gift-code" className="text-sm font-medium">
            Gift card code
          </Label>
          <Input
            id="pos-gift-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void lookup(code);
            }}
            placeholder="ABCD-EFGH-JKMN"
            autoComplete="off"
            className="min-h-11 font-mono text-base"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
              Back
            </Button>
            <Button className="min-h-11 flex-1" onClick={() => void lookup(code)} disabled={busy || !code.trim()}>
              {busy ? 'Checking…' : 'Check balance'}
            </Button>
          </div>
        </>
      )}

      {card && (
        <>
          <div className="rounded-md border p-3">
            <p className="font-mono text-sm text-muted-foreground">{card.code}</p>
            <dl className="mt-1 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Balance now</dt>
                <dd className="text-lg font-semibold">{formatMoney(card.balanceCents)}</dd>
              </div>
              {card.usable && (
                <>
                  <div className="flex justify-between">
                    <dt>Goes on this order</dt>
                    <dd className="font-medium">−{formatMoney(applyCents)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <dt>Balance after</dt>
                    <dd className="font-semibold">{formatMoney(card.balanceCents - applyCents)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {!card.usable && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{card.reason}</p>
          )}
          {card.usable && applyCents < remaining && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              This card doesn&apos;t cover the whole order. {formatMoney(remaining - applyCents)} will be left to pay
              another way.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={() => setCard(null)} disabled={busy}>
              Different card
            </Button>
            <Button className="min-h-11 flex-1" onClick={redeem} disabled={busy || !card.usable || applyCents <= 0}>
              {busy ? 'Redeeming…' : `Redeem ${formatMoney(applyCents)}`}
            </Button>
          </div>
          <Button variant="ghost" className="min-h-11" onClick={onBack} disabled={busy}>
            Back to payment options
          </Button>
        </>
      )}
    </div>
  );
}
