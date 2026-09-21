'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '../types';

const GIFT_CARD_PRESETS = [2500, 5000, 10000];

export function GiftCardTab({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (payload: { itemType: 'GIFT_CARD'; unitPriceCents: number; metadata: Record<string, unknown> }) => void;
}) {
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  function submit() {
    const cents = amountCents ?? Math.round(parseFloat(customAmount || '0') * 100);
    if (!cents || cents <= 0) return;
    onAdd({
      itemType: 'GIFT_CARD',
      unitPriceCents: cents,
      metadata: {
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
      },
    });
    setAmountCents(null);
    setCustomAmount('');
    setRecipientName('');
    setRecipientEmail('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {GIFT_CARD_PRESETS.map((cents) => (
          <Button
            key={cents}
            variant={amountCents === cents ? 'default' : 'outline'}
            className="min-h-11 flex-1"
            onClick={() => {
              setAmountCents(cents);
              setCustomAmount('');
            }}
          >
            {formatMoney(cents)}
          </Button>
        ))}
      </div>
      <div>
        <Label className="text-sm font-medium">Custom amount</Label>
        <Input
          inputMode="decimal"
          placeholder="0.00"
          value={customAmount}
          onChange={(e) => {
            setCustomAmount(e.target.value);
            setAmountCents(null);
          }}
          className="mt-1 min-h-11 text-base"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-sm font-medium">Recipient name (optional)</Label>
          <Input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="mt-1 min-h-11 text-base"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Recipient email (optional)</Label>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="mt-1 min-h-11 text-base"
          />
        </div>
      </div>
      <Button className="min-h-11" disabled={disabled || (!amountCents && !customAmount)} onClick={submit}>
        Add to cart
      </Button>
    </div>
  );
}
