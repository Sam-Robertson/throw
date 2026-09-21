'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage, formatMoney, type ApiErrorBody, type PosOrder } from '../types';
import { JSON_HEADERS, type PaneProps } from './paneTypes';

interface AccountCreditPaneProps extends PaneProps {
  remaining: number;
  availableCents: number;
  customerName: string;
}

/** Pays with the attached customer's account credit, in full or in part. */
export function AccountCreditPane({
  orderId,
  remaining,
  availableCents,
  customerName,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
}: AccountCreditPaneProps) {
  const maxCents = Math.min(availableCents, remaining);
  const [amount, setAmount] = useState((maxCents / 100).toFixed(2));

  const dollars = parseFloat(amount);
  const amountCents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
  const tooMuch = amountCents > maxCents;

  async function submit() {
    if (amountCents <= 0 || tooMuch) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${orderId}/payments/account-credit`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ amountCents }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError('Could not reach the server. Check the order before trying again.');
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Failed to apply account credit'));
      return;
    }
    const data = (await res.json()) as {
      order: PosOrder;
      amountApplied: number;
      accountCreditRemainingCents: number;
    };
    onResult(
      data.order,
      `Account credit took ${formatMoney(data.amountApplied)}. ${customerName} has ${formatMoney(data.accountCreditRemainingCents)} credit left.`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-3 text-sm">
        <div className="flex justify-between">
          <span>{customerName}&apos;s credit</span>
          <span className="text-lg font-semibold">{formatMoney(availableCents)}</span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span>Credit after</span>
          <span className="font-semibold">{formatMoney(Math.max(0, availableCents - amountCents))}</span>
        </div>
      </div>

      <Label htmlFor="pos-credit-amount" className="text-sm font-medium">
        Amount to use
      </Label>
      <Input
        id="pos-credit-amount"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="min-h-11 text-base"
      />
      {tooMuch && (
        <p className="text-sm text-destructive">The most that can go on this order is {formatMoney(maxCents)}.</p>
      )}
      {!tooMuch && amountCents > 0 && amountCents < remaining && (
        <p className="text-sm text-muted-foreground">
          {formatMoney(remaining - amountCents)} will be left to pay another way.
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button className="min-h-11 flex-1" onClick={submit} disabled={busy || amountCents <= 0 || tooMuch}>
          {busy ? 'Applying…' : `Use ${formatMoney(amountCents)} credit`}
        </Button>
      </div>
    </div>
  );
}
