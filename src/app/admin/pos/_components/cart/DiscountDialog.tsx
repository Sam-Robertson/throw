'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMountainTime } from '@/lib/timezone';
import {
  apiErrorMessage,
  type ApiErrorBody,
  type PosCatalog,
  type PosOrder,
  type StaffDiscount,
} from '../types';
import { describeDiscount } from './discountLabels';
import { DISCOUNT_NOTE_POLICY, LARGE_DISCOUNT_NOTE_MESSAGE, isLargeDiscount } from './discountPolicy';

// The note thresholds are policy, kept in one object the discounts route also
// enforces. Re-exported here so the picker is the one place to look.
export { DISCOUNT_NOTE_POLICY };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PosOrder;
  catalog: PosCatalog | null;
  /** The repriced order, plus the server's "applied but taking $0 off yet" hint. */
  onApplied: (order: PosOrder, discountWarning: string | null) => void;
}

export function DiscountDialog({ open, onOpenChange, order, catalog, onApplied }: DiscountDialogProps) {
  const [selected, setSelected] = useState<StaffDiscount | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [groupEventSessionId, setGroupEventSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffDiscounts = catalog?.staffDiscounts ?? [];
  const groupEvents = catalog?.groupEventSessions ?? [];
  const appliedIds = new Set(order.discounts.map((d) => d.discountCodeId));

  function reset() {
    setSelected(null);
    setCode('');
    setNote('');
    setGroupEventSessionId('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const noteRequired = !!selected && (selected.requiresNote || isLargeDiscount(selected));
  const missingCustomer = !!selected?.requiresCustomer && !order.customerId;
  const missingGroupEvent = !!selected?.requiresGroupEvent && !groupEventSessionId;
  const missingNote = noteRequired && !note.trim();
  const canApply = (!!selected || !!code.trim()) && !missingCustomer && !missingGroupEvent && !missingNote;

  async function apply() {
    if (!canApply) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${order.id}/discounts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ...(selected ? { discountCodeId: selected.id } : { code: code.trim() }),
        note: note.trim() || undefined,
        groupEventSessionId: selected?.requiresGroupEvent ? groupEventSessionId : undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError('Could not reach the server. Check the connection and try again.');
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Could not apply that discount'));
      return;
    }
    const data = (await res.json()) as PosOrder & { discountWarning?: string | null };
    onApplied(data, data.discountWarning ?? null);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a discount</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {staffDiscounts.length > 0 && (
          <div className="flex flex-col gap-2">
            {staffDiscounts.map((d) => {
              const already = appliedIds.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={already || busy}
                  onClick={() => {
                    setSelected(selected?.id === d.id ? null : d);
                    setCode('');
                    setError(null);
                  }}
                  aria-pressed={selected?.id === d.id}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left disabled:opacity-50 ${
                    selected?.id === d.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{d.name ?? d.code}</span>
                    {d.description && (
                      <span className="block text-sm text-muted-foreground">{d.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {already ? 'On this order' : describeDiscount(d)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!selected && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-promo-code" className="text-sm font-medium">
              {staffDiscounts.length > 0 ? 'Or type a promo code' : 'Promo code'}
            </Label>
            <Input
              id="pos-promo-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-11 text-base"
            />
          </div>
        )}

        {selected?.requiresGroupEvent && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-group-event" className="text-sm font-medium">
              Which group event is this for?
            </Label>
            {groupEvents.length === 0 ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                There are no recent group events at this studio, so this discount can&apos;t be used.
              </p>
            ) : (
              <select
                id="pos-group-event"
                value={groupEventSessionId}
                onChange={(e) => setGroupEventSessionId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                <option value="">Choose the event…</option>
                {groupEvents.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}, {formatMountainTime(new Date(g.startsAt), 'datetime')}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {missingCustomer && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            This discount is tracked per customer. Close this and attach the customer to the order first.
          </p>
        )}

        {(selected || code.trim()) && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-discount-note" className="text-sm font-medium">
              Note {noteRequired ? '(required)' : '(optional)'}
            </Label>
            <Input
              id="pos-discount-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this discount being given?"
              maxLength={500}
              className="min-h-11 text-base"
            />
            {selected && isLargeDiscount(selected) && (
              <p className="text-xs text-muted-foreground">{LARGE_DISCOUNT_NOTE_MESSAGE}</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button className="min-h-11 flex-1" onClick={apply} disabled={busy || !canApply}>
            {busy ? 'Applying…' : 'Apply discount'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
