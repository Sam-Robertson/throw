'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney, isQuantityLocked, manualDiscountCentsOf, type PosOrderItem } from '../types';

interface LineItemRowProps {
  item: PosOrderItem;
  busy: boolean;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onSetDiscount: (itemId: string, discountCents: number) => void;
  onSetNote: (itemId: string, note: string | null) => Promise<void> | void;
}

type Editing = 'note' | 'discount' | null;

/**
 * One order line, laid out in two rows so it fits the narrow order column on
 * an iPad: name and total on top, quantity / note / remove underneath.
 */
export function LineItemRow({
  item,
  busy,
  onUpdateQuantity,
  onRemove,
  onSetDiscount,
  onSetNote,
}: LineItemRowProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const locked = isQuantityLocked(item);

  function open(which: Exclude<Editing, null>) {
    // The editor holds the manual dollar discount only; named discounts are
    // shared out on top of it by the server.
    const manual = manualDiscountCentsOf(item);
    setDraft(which === 'note' ? (item.note ?? '') : manual ? (manual / 100).toFixed(2) : '');
    setEditing(which);
  }

  async function save() {
    if (editing === 'note') {
      await onSetNote(item.id, draft.trim() || null);
    } else if (editing === 'discount') {
      const dollars = parseFloat(draft);
      onSetDiscount(item.id, Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0);
    }
    setEditing(null);
  }

  return (
    <div className="p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium leading-snug">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {locked || item.quantity === 1
              ? formatMoney(item.unitPriceCents)
              : `${item.quantity} × ${formatMoney(item.unitPriceCents)}`}
          </p>
        </div>

        {/* Line total: tap to give this line a dollar discount */}
        <button
          type="button"
          onClick={() => open('discount')}
          disabled={busy}
          className="min-h-11 shrink-0 rounded-md px-2 text-right font-semibold hover:bg-muted"
          aria-label={`Discount ${item.name}`}
        >
          {formatMoney(item.totalCents)}
          <span
            className={`block text-xs font-normal ${
              item.discountCents > 0 ? 'text-green-700' : 'text-muted-foreground underline'
            }`}
          >
            {item.discountCents > 0 ? `−${formatMoney(item.discountCents)}` : 'Discount'}
          </span>
        </button>
      </div>

      {item.note && editing !== 'note' && (
        <p className="mt-1 break-words rounded bg-muted/60 px-2 py-1 text-sm">Note: {item.note}</p>
      )}

      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Input
            autoFocus
            inputMode={editing === 'discount' ? 'decimal' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            placeholder={editing === 'discount' ? 'Dollars off this line' : 'Note for this line'}
            maxLength={editing === 'note' ? 500 : undefined}
            aria-label={editing === 'discount' ? `Dollars off ${item.name}` : `Note for ${item.name}`}
            className="min-h-11 min-w-32 flex-1 text-base"
          />
          <Button className="min-h-11 shrink-0" onClick={() => void save()} disabled={busy}>
            Save
          </Button>
          <Button variant="ghost" className="min-h-11 shrink-0 px-2" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {/* Quantity stepper (not for drop-ins, by-weight or firing lines) */}
          {!locked && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                onClick={() =>
                  item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, item.quantity - 1)
                }
                disabled={busy}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </Button>
              <span className="w-7 text-center font-medium" aria-label={`Quantity ${item.quantity}`}>
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                disabled={busy}
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            className="min-h-11 px-2 text-muted-foreground"
            onClick={() => open('note')}
            disabled={busy}
          >
            {item.note ? 'Edit note' : 'Add note'}
          </Button>
          <Button
            variant="ghost"
            className="ml-auto min-h-11 shrink-0 px-2 text-destructive"
            onClick={() => onRemove(item.id)}
            disabled={busy}
            aria-label={`Remove ${item.name}`}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
