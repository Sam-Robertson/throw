'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * A one-off charge. The description is required (here and on the server) so a
 * custom sale never shows up as unlabeled revenue.
 */
export function CustomTab({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (payload: { itemType: 'CUSTOM'; name: string; unitPriceCents: number }) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);

  const cents = Math.round(parseFloat(amount || '0') * 100);
  const hasAmount = Number.isFinite(cents) && cents > 0;
  const missingName = !name.trim();

  function submit() {
    setTouched(true);
    if (missingName || !hasAmount) return;
    onAdd({ itemType: 'CUSTOM', name: name.trim(), unitPriceCents: cents });
    setName('');
    setAmount('');
    setTouched(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="text-sm font-medium">Description (required)</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="What is this charge for?"
          maxLength={200}
          aria-invalid={touched && missingName}
          className="mt-1 min-h-11 text-base"
        />
        {touched && missingName && (
          <p className="mt-1 text-sm text-destructive">
            Describe the charge so it shows up labeled in the sales reports.
          </p>
        )}
      </div>
      <div>
        <Label className="text-sm font-medium">Amount</Label>
        <Input
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          className="mt-1 min-h-11 text-base"
        />
      </div>
      <Button className="min-h-11" disabled={disabled || missingName || !hasAmount} onClick={submit}>
        Add to cart
      </Button>
    </div>
  );
}
