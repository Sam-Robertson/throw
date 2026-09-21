'use client';

import { Button } from '@/components/ui/button';
import { formatMoney, type PosOrder, type PosOrderDiscount } from '../types';
import { describeDiscount } from './discountLabels';

interface OrderSummaryProps {
  order: PosOrder | null;
  busy: boolean;
  /** Set when Stripe Tax fell back to zero, so staff know the tax line is off. */
  taxWarning: string | null;
  onRemoveDiscount: (discount: PosOrderDiscount) => void;
}

/** Subtotal, each discount by name, tax, tip and total. */
export function OrderSummary({ order, busy, taxWarning, onRemoveDiscount }: OrderSummaryProps) {
  const discounts = order?.discounts ?? [];
  const namedCents = discounts.reduce((sum, d) => sum + d.amountCents, 0);
  // order.discountCents is every line's discount; what isn't a named discount
  // was typed onto a line by hand.
  const lineDiscountCents = Math.max(0, (order?.discountCents ?? 0) - namedCents);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatMoney(order?.subtotalCents ?? 0)}</span>
        </div>

        {discounts.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 text-green-700">
            <div className="min-w-0">
              <p className="break-words">
                {d.name}
                {d.discountCode ? ` · ${describeDiscount(d.discountCode)}` : ''}
              </p>
              {d.automatic && (
                <p className="text-xs text-muted-foreground">Automatic. Comes with the customer&apos;s membership.</p>
              )}
              {!d.automatic && d.amountCents === 0 && (
                <p className="text-xs text-amber-700">Takes effect when a qualifying item is added.</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span>−{formatMoney(d.amountCents)}</span>
              {!d.automatic && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 text-destructive"
                  onClick={() => onRemoveDiscount(d)}
                  disabled={busy}
                  aria-label={`Remove ${d.name}`}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}

        {lineDiscountCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Line discounts</span>
            <span>−{formatMoney(lineDiscountCents)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span>{formatMoney(order?.taxCents ?? 0)}</span>
        </div>
        {taxWarning && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{taxWarning}</p>}

        {(order?.tipCents ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tip</span>
            <span>{formatMoney(order!.tipCents)}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-2xl font-bold">{formatMoney(order?.totalCents ?? 0)}</span>
      </div>
    </div>
  );
}
