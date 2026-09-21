'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiErrorMessage, type ApiErrorBody, type PosOrder } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface CustomAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onAdded: (order: PosOrder) => void;
}

/** A one-off charge: an amount and a description that says what it was for. */
export function CustomAmountDialog({ open, onOpenChange, orderId, onAdded }: CustomAmountDialogProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setAmount('');
      setDescription('');
      setError(null);
    }
    onOpenChange(next);
  }

  const dollars = parseFloat(amount);
  const cents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
  const canAdd = cents > 0 && !!description.trim();

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${orderId}/items`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        itemType: 'CUSTOM',
        name: description.trim(),
        unitPriceCents: cents,
        quantity: 1,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError('Could not reach the server. Check the connection and try again.');
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Could not add that amount'));
      return;
    }
    onAdded((await res.json()) as PosOrder);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Custom amount</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pos-custom-amount" className="text-sm font-medium">
            Amount
          </Label>
          <Input
            id="pos-custom-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="min-h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pos-custom-description" className="text-sm font-medium">
            What is it for? (required)
          </Label>
          <Input
            id="pos-custom-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shows on the order and the receipt"
            maxLength={120}
            className="min-h-11 text-base"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button className="min-h-11 flex-1" onClick={add} disabled={busy || !canAdd}>
            {busy ? 'Adding…' : 'Add to order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
