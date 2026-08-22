'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatMoney, type PosOrder } from './types';

interface CustomerMatch {
  id: string;
  name: string | null;
  email: string;
}

interface CustomerDetail {
  id: string;
  name: string | null;
  email: string;
  memberships: { status: string }[];
}

function membershipBadge(memberships: { status: string }[] | undefined) {
  if (!memberships || memberships.length === 0) {
    return { label: 'No membership', className: 'bg-muted text-muted-foreground' };
  }
  if (memberships.some((m) => m.status === 'ACTIVE')) {
    return { label: 'Active member', className: 'bg-green-100 text-green-800 border-green-200' };
  }
  if (memberships.some((m) => m.status === 'PAUSED')) {
    return { label: 'Paused member', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return { label: 'No active membership', className: 'bg-muted text-muted-foreground' };
}

interface CartPanelProps {
  order: PosOrder | null;
  busy: boolean;
  onUpdateItemQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSetItemDiscount: (itemId: string, discountCents: number) => void;
  onAttachCustomer: (customerId: string | null) => void;
  onSetTip: (tipCents: number) => void;
  onVoid: (reason: string) => void;
  onCharge: () => void;
}

const TIP_PRESETS = [100, 200, 500];

export function CartPanel({
  order,
  busy,
  onUpdateItemQuantity,
  onRemoveItem,
  onSetItemDiscount,
  onAttachCustomer,
  onSetTip,
  onVoid,
  onCharge,
}: CartPanelProps) {
  const [walkInConfirmed, setWalkInConfirmed] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [discountItemId, setDiscountItemId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');

  const [tipPanelOpen, setTipPanelOpen] = useState(false);
  const [customTip, setCustomTip] = useState('');

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Debounced customer typeahead search.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!customerQuery.trim()) {
      setCustomerMatches([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(customerQuery.trim())}`);
      if (res.ok) setCustomerMatches((await res.json()) as CustomerMatch[]);
      setSearching(false);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [customerQuery]);

  // Load membership detail once a customer is attached.
  useEffect(() => {
    if (!order?.customerId) {
      setCustomerDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/customers/${order.customerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CustomerDetail | null) => {
        if (!cancelled) setCustomerDetail(data);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.customerId]);

  function selectCustomer(customer: CustomerMatch) {
    setCustomerQuery('');
    setCustomerMatches([]);
    onAttachCustomer(customer.id);
  }

  function detachCustomer() {
    setWalkInConfirmed(false);
    onAttachCustomer(null);
  }

  function openDiscountEditor(itemId: string, currentDiscountCents: number) {
    setDiscountItemId(itemId);
    setDiscountInput(currentDiscountCents ? (currentDiscountCents / 100).toFixed(2) : '');
  }

  function submitDiscount() {
    if (!discountItemId) return;
    const dollars = parseFloat(discountInput);
    const cents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
    onSetItemDiscount(discountItemId, cents);
    setDiscountItemId(null);
  }

  function submitCustomTip() {
    const dollars = parseFloat(customTip);
    if (Number.isFinite(dollars) && dollars >= 0) {
      onSetTip(Math.round(dollars * 100));
      setCustomTip('');
      setTipPanelOpen(false);
    }
  }

  function submitVoid() {
    if (!voidReason.trim()) return;
    onVoid(voidReason.trim());
    setVoidOpen(false);
    setVoidReason('');
  }

  const items = order?.items ?? [];
  const cartEmpty = items.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Customer section */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Customer</h3>

        {order?.customerId && order.customer ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{order.customer.name ?? order.customer.email}</p>
              <p className="text-sm text-muted-foreground">{order.customer.email}</p>
              <Badge className={`mt-1.5 ${membershipBadge(customerDetail?.memberships).className}`}>
                {membershipBadge(customerDetail?.memberships).label}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11 shrink-0"
              onClick={detachCustomer}
              disabled={busy}
              aria-label="Detach customer"
            >
              ×
            </Button>
          </div>
        ) : walkInConfirmed ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Walk-in customer, no account</p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setWalkInConfirmed(false)}
              disabled={busy}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Search customers by name or email…"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="min-h-11 text-base"
            />
            {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
            {customerMatches.length > 0 && (
              <div className="divide-y rounded-md border">
                {customerMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="font-medium">{c.name ?? c.email}</span>
                    <span className="text-sm text-muted-foreground">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => setWalkInConfirmed(true)}
              disabled={busy}
            >
              Walk-in, no account
            </Button>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border bg-card">
        {cartEmpty ? (
          <p className="p-4 text-sm text-muted-foreground">No items in this order yet.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{formatMoney(item.unitPriceCents)} each</p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-11 min-w-11"
                    onClick={() =>
                      item.quantity <= 1
                        ? onRemoveItem(item.id)
                        : onUpdateItemQuantity(item.id, item.quantity - 1)
                    }
                    disabled={busy}
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-11 min-w-11"
                    onClick={() => onUpdateItemQuantity(item.id, item.quantity + 1)}
                    disabled={busy}
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    +
                  </Button>
                </div>

                {/* Line total — tap to edit discount */}
                {discountItemId === item.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      inputMode="decimal"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="0.00"
                      className="min-h-11 w-20 text-base"
                    />
                    <Button size="sm" className="min-h-11" onClick={submitDiscount}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDiscountEditor(item.id, item.discountCents)}
                    className="min-h-11 min-w-20 rounded-md px-2 text-right font-semibold hover:bg-muted"
                    title="Tap to add a discount"
                  >
                    {formatMoney(item.totalCents)}
                    {item.discountCents > 0 && (
                      <span className="block text-xs font-normal text-green-700">
                        −{formatMoney(item.discountCents)}
                      </span>
                    )}
                  </button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 shrink-0 text-destructive"
                  onClick={() => onRemoveItem(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.name}`}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatMoney(order?.subtotalCents ?? 0)}</span>
          </div>
          {(order?.discountCents ?? 0) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount</span>
              <span>−{formatMoney(order!.discountCents)}</span>
            </div>
          )}
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

      {/* Actions */}
      <div className="space-y-2">
        {tipPanelOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
            {TIP_PRESETS.map((cents) => (
              <Button
                key={cents}
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  onSetTip(cents);
                  setTipPanelOpen(false);
                }}
              >
                {formatMoney(cents)}
              </Button>
            ))}
            <div className="flex flex-1 items-center gap-1.5">
              <Input
                inputMode="decimal"
                placeholder="Custom $"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                className="min-h-11 text-base"
              />
              <Button className="min-h-11" onClick={submitCustomTip}>
                Set
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => setTipPanelOpen((v) => !v)}
            disabled={busy || !order}
          >
            Add tip
          </Button>
          <Button
            variant="outline"
            className="min-h-11 flex-1 text-destructive"
            onClick={() => setVoidOpen(true)}
            disabled={busy || !order}
          >
            Void order
          </Button>
        </div>

        <Button
          className="min-h-14 w-full text-lg font-semibold"
          onClick={onCharge}
          disabled={busy || cartEmpty}
        >
          Charge {formatMoney(order?.totalCents ?? 0)}
        </Button>
      </div>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone from this screen. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Reason for voiding"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="min-h-11 text-base"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={submitVoid}
              disabled={!voidReason.trim()}
            >
              Void order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
