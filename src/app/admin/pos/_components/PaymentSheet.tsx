'use client';

import { useCallback, useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { realEmail } from '@/lib/walkinEmail';
import { getStripePromise } from './stripeClient';
import { TerminalPane } from './TerminalPane';
import { AccountCreditPane } from './payment/AccountCreditPane';
import { CardPane } from './payment/CardPane';
import { CompPane } from './payment/CompPane';
import { GiftCardPane } from './payment/GiftCardPane';
import { SuccessPane } from './payment/SuccessPane';
import { JSON_HEADERS } from './payment/paneTypes';
import { useReaderStatus } from './payment/useReaderStatus';
import {
  apiErrorMessage,
  formatMoney,
  orderHasDropIn,
  remainingBalanceCents,
  type ApiErrorBody,
  type CustomerSummary,
  type PosOrder,
} from './types';

type View = 'methods' | 'terminal' | 'card' | 'giftcard' | 'credit' | 'comp';

interface PaymentSheetProps {
  order: PosOrder | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: (order: PosOrder) => void;
  onNewOrder: () => void;
}

/**
 * The tender sheet. Card reader first and largest; gift card, account credit
 * (when the customer has some), typed-in card and admin comp underneath. The
 * studio takes no cash. Tenders can be combined: each one takes what it can
 * and the sheet comes back here with what is left.
 */
export function PaymentSheet({
  order,
  isAdmin,
  open,
  onOpenChange,
  onOrderUpdate,
  onNewOrder,
}: PaymentSheetProps) {
  const [view, setView] = useState<View>('methods');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the last tender did ("Gift card took $20.00. It has $5.00 left.").
  const [tenderNote, setTenderNote] = useState<string | null>(null);
  const [readerWaiting, setReaderWaiting] = useState(false);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);

  const reader = useReaderStatus(order?.locationId);

  const orderId = order?.id ?? null;
  const customerId = order?.customerId ?? null;
  const locationId = order?.locationId ?? null;
  const paymentCount = order?.payments.length ?? 0;

  // Credit, gift cards and the receipt contact for the attached customer.
  // Reloaded after every tender, since each one can change the balances.
  useEffect(() => {
    if (!open || !customerId || !locationId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/pos/customers/${customerId}/summary?locationId=${locationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CustomerSummary | null) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, customerId, locationId, paymentCount]);

  // Make sure the reader status is fresh the moment the sheet opens.
  const refreshReader = reader.refresh;
  useEffect(() => {
    if (open) void refreshReader();
  }, [open, refreshReader]);

  useEffect(() => {
    setView('methods');
    setError(null);
    setTenderNote(null);
  }, [orderId]);

  const handleOrderResult = useCallback(
    (updated: PosOrder, note?: string) => {
      onOrderUpdate(updated);
      setError(null);
      setTenderNote(note ?? null);
      setView('methods');
    },
    [onOrderUpdate],
  );

  if (!order) return null;

  const remaining = remainingBalanceCents(order);
  const completed = order.status === 'COMPLETED';
  const needsCustomer = orderHasDropIn(order) && !order.customerId;
  const creditCents = summary?.accountCreditCents ?? 0;
  const customerName = order.customer?.name ?? realEmail(order.customer?.email) ?? 'This customer';

  function handleOpenChange(next: boolean) {
    // The reader is asking for a card: the way out is Cancel payment, so a
    // stray tap outside the sheet can't orphan a payment in progress.
    if (!next && readerWaiting) return;
    if (!next) {
      setView('methods');
      setError(null);
      setTenderNote(null);
    }
    onOpenChange(next);
  }

  async function completeWithNothingToPay() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${order.id}/payments/no-charge`, {
      method: 'POST',
      headers: JSON_HEADERS,
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as ApiErrorBody) : {};
      setError(apiErrorMessage(data, 'Could not complete the order'));
      return;
    }
    handleOrderResult(((await res.json()) as { order: PosOrder }).order);
  }

  const paneProps = {
    orderId: order.id,
    busy,
    setBusy,
    setError,
    onBack: () => {
      setError(null);
      setView('methods');
    },
    onResult: handleOrderResult,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`max-h-[95vh] overflow-y-auto ${readerWaiting ? 'max-w-3xl' : 'max-w-lg'}`}
        onEscapeKeyDown={(e) => {
          if (readerWaiting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{completed ? 'Payment complete' : `Order #${order.orderNumber}`}</DialogTitle>
        </DialogHeader>

        {!completed && !readerWaiting && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total {formatMoney(order.totalCents)}</span>
            <span className="text-base font-semibold">To pay {formatMoney(remaining)}</span>
          </div>
        )}

        {!completed && tenderNote && view === 'methods' && (
          <div className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-900">
            {tenderNote} {remaining > 0 ? `${formatMoney(remaining)} left to pay.` : ''}
          </div>
        )}

        {!completed && error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {!completed && view === 'methods' && needsCustomer && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            This order books a class seat. Close this and attach the customer before taking payment.
          </div>
        )}

        {!completed && view === 'methods' && remaining === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">There is nothing to pay on this order.</p>
            <Button className="min-h-16 text-lg" onClick={completeWithNothingToPay} disabled={busy}>
              {busy ? 'Completing…' : 'Complete order'}
            </Button>
          </div>
        )}

        {!completed && view === 'methods' && remaining > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="col-span-2 flex h-auto min-h-24 flex-col gap-1 whitespace-normal text-xl font-semibold"
              onClick={() => {
                setError(null);
                setTenderNote(null);
                setView('terminal');
              }}
              disabled={!reader.ready || busy}
            >
              <span>Card reader · {formatMoney(remaining)}</span>
              <span className="text-sm font-normal opacity-90">
                {reader.readers === null
                  ? 'Checking the reader…'
                  : reader.ready
                    ? `${reader.selected!.label}${reader.selected!.busy ? ' · in use' : ' · ready'}`
                    : 'No reader connected'}
              </span>
            </Button>

            {reader.readers !== null && !reader.ready && (
              <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                <span>{reader.reason} Use another way to pay below.</span>
                <Button
                  variant="outline"
                  className="min-h-11 shrink-0 text-foreground"
                  onClick={() => void reader.refresh()}
                  disabled={reader.checking}
                >
                  {reader.checking ? 'Checking…' : 'Reconnect'}
                </Button>
              </div>
            )}

            {/* With no reader, the fallbacks become the primary buttons. */}
            <Button
              className="min-h-14 text-base"
              variant={reader.ready ? 'secondary' : 'default'}
              onClick={() => setView('giftcard')}
              disabled={busy}
            >
              Gift card
            </Button>
            {customerId && creditCents > 0 ? (
              <Button
                className="flex h-auto min-h-14 flex-col gap-0 whitespace-normal text-base"
                variant={reader.ready ? 'secondary' : 'default'}
                onClick={() => setView('credit')}
                disabled={busy}
              >
                <span>Account credit</span>
                <span className="text-xs font-normal">{formatMoney(creditCents)} available</span>
              </Button>
            ) : null}
            {/* Manual entry stays available for phone orders and as a fallback
                when the reader is offline. */}
            <Button
              className="min-h-14 text-base"
              variant={reader.ready ? 'outline' : 'default'}
              onClick={() => setView('card')}
              disabled={busy}
            >
              Enter card
            </Button>
            {isAdmin && (
              <Button className="min-h-14 text-base" variant="outline" onClick={() => setView('comp')} disabled={busy}>
                Comp
              </Button>
            )}
          </div>
        )}

        {!completed && view === 'terminal' && (
          <TerminalPane
            {...paneProps}
            remaining={remaining}
            reader={reader}
            onWaitingChange={setReaderWaiting}
          />
        )}

        {!completed && view === 'card' && (
          <Elements stripe={getStripePromise()}>
            <CardPane {...paneProps} remaining={remaining} />
          </Elements>
        )}

        {!completed && view === 'giftcard' && (
          <GiftCardPane {...paneProps} remaining={remaining} customerCards={summary?.giftCards ?? []} />
        )}

        {!completed && view === 'credit' && (
          <AccountCreditPane
            {...paneProps}
            remaining={remaining}
            availableCents={creditCents}
            customerName={customerName}
          />
        )}

        {!completed && view === 'comp' && <CompPane {...paneProps} remaining={remaining} />}

        {completed && (
          <SuccessPane
            key={order.id}
            order={order}
            customerPhone={summary?.customer.phone ?? null}
            onNewOrder={() => {
              handleOpenChange(false);
              onNewOrder();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
