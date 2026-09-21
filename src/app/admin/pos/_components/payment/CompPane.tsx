'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage, type ApiErrorBody, type PosOrder } from '../types';
import { JSON_HEADERS, type PaneProps } from './paneTypes';

/** Admin-only: write off some or all of the balance, with a reason. */
export function CompPane({
  orderId,
  remaining,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
}: PaneProps & { remaining: number }) {
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState('');

  async function submit() {
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (!amountCents || amountCents <= 0 || !reason.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${orderId}/payments/comp`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ amountCents, reason: reason.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as { order: PosOrder };
      onResult(data.order);
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Failed to comp order'));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">Amount</Label>
      <Input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="min-h-11 text-base"
      />
      <Label className="text-sm font-medium">Reason</Label>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Required"
        className="min-h-11 text-base"
      />
      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button
          className="min-h-11 flex-1"
          onClick={submit}
          disabled={busy || !reason.trim() || !amount}
        >
          Comp order
        </Button>
      </div>
    </div>
  );
}
