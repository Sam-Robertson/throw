'use client';

import { useState } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getStripePromise } from './stripeClient';
import { TerminalPane } from './TerminalPane';
import {
  apiErrorMessage,
  formatMoney,
  giftCardCodesFromOrder,
  orderHasDropIn,
  remainingBalanceCents,
  type ApiErrorBody,
  type PosOrder,
} from './types';

type View = 'methods' | 'terminal' | 'card' | 'giftcard' | 'comp' | 'success';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface PaymentSheetProps {
  order: PosOrder | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: (order: PosOrder) => void;
  onNewOrder: () => void;
}

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

  if (!order) return null;

  const remaining = remainingBalanceCents(order);

  function reset() {
    setView('methods');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleOrderResult(updated: PosOrder) {
    onOrderUpdate(updated);
    if (remainingBalanceCents(updated) <= 0) {
      setView('success');
    } else {
      setView('methods');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === 'success' ? 'Payment complete' : `Order #${order.orderNumber}`}
          </DialogTitle>
        </DialogHeader>

        {view !== 'success' && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total {formatMoney(order.totalCents)}</span>
            <span className="font-semibold">Remaining {formatMoney(remaining)}</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {view === 'methods' && orderHasDropIn(order) && !order.customerId && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            This order books a class seat. Close this and attach the customer before taking payment.
          </div>
        )}

        {view === 'methods' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="col-span-2 min-h-16 text-base"
              onClick={() => setView('terminal')}
            >
              Tap or insert card
            </Button>
            <Button className="min-h-14" onClick={() => setView('giftcard')}>Gift Card</Button>
            {/* Manual entry stays available for phone orders and as a fallback
                when the reader is offline. */}
            <Button className="min-h-14" variant="outline" onClick={() => setView('card')}>
              Enter card
            </Button>
            {isAdmin && (
              <Button className="min-h-14" variant="outline" onClick={() => setView('comp')}>
                Comp
              </Button>
            )}
          </div>
        )}

        {view === 'terminal' && (
          <TerminalPane
            orderId={order.id}
            locationId={order.locationId}
            remaining={remaining}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onBack={() => setView('methods')}
            onResult={(updated) => handleOrderResult(updated)}
          />
        )}

        {view === 'card' && (
          <Elements stripe={getStripePromise()}>
            <CardPane
              orderId={order.id}
              remaining={remaining}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onBack={() => setView('methods')}
              onResult={handleOrderResult}
            />
          </Elements>
        )}

        {view === 'giftcard' && (
          <GiftCardPane
            orderId={order.id}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onBack={() => setView('methods')}
            onResult={handleOrderResult}
          />
        )}

        {view === 'comp' && (
          <CompPane
            orderId={order.id}
            remaining={remaining}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onBack={() => setView('methods')}
            onResult={handleOrderResult}
          />
        )}

        {view === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-lg font-semibold">Order #{order.orderNumber} paid</p>
            {giftCardCodesFromOrder(order).length > 0 && (
              <div className="w-full rounded-lg border-2 border-foreground p-4 text-left">
                <p className="text-sm font-semibold">Gift card codes. Give these to the customer.</p>
                {giftCardCodesFromOrder(order).map((g) =>
                  g.codes.map((code) => (
                    <div key={code} className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
                      <span className="text-sm text-muted-foreground">{formatMoney(g.amountCents)}</span>
                    </div>
                  )),
                )}
              </div>
            )}
            {order.note && (
              <p className="w-full whitespace-pre-line rounded-md border bg-muted/40 p-2 text-left text-sm">
                {order.note}
              </p>
            )}
            <div className="grid w-full grid-cols-1 gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  await fetch(`/api/pos/orders/${order.id}/receipt`, { method: 'POST' });
                }}
              >
                Email receipt
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => window.print()}>
                Print
              </Button>
              <Button
                className="min-h-11"
                onClick={() => {
                  handleOpenChange(false);
                  onNewOrder();
                }}
              >
                New order
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PaneProps {
  orderId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onResult: (order: PosOrder) => void;
}

function CardPane({
  orderId,
  remaining,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
}: PaneProps & { remaining: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  async function createIntent() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${orderId}/payments/card-manual`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ amountCents: remaining }),
    });
    if (res.ok) {
      const data = (await res.json()) as { clientSecret: string; paymentId: string };
      setClientSecret(data.clientSecret);
      setPaymentId(data.paymentId);
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Failed to start card payment'));
    }
    setBusy(false);
  }

  async function pollConfirm(id: string, attemptsLeft: number): Promise<void> {
    const res = await fetch(`/api/pos/orders/${orderId}/payments/${id}/confirm`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{}',
    });
    if (res.ok) {
      const data = (await res.json()) as { order: PosOrder };
      onResult(data.order);
      return;
    }
    if (attemptsLeft > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      return pollConfirm(id, attemptsLeft - 1);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? 'Could not confirm the card payment');
  }

  async function submit() {
    if (!stripe || !elements || !clientSecret || !paymentId) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setBusy(true);
    setError(null);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    if (result.error) {
      setError(result.error.message ?? 'Card was declined');
      setBusy(false);
      return;
    }

    await pollConfirm(paymentId, 4);
    setBusy(false);
  }

  if (!clientSecret) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Charge {formatMoney(remaining)} to a card.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button className="min-h-11 flex-1" onClick={createIntent} disabled={busy}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-3">
        <CardElement options={{ hidePostalCode: false }} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button className="min-h-11 flex-1" onClick={submit} disabled={busy || !stripe}>
          Pay {formatMoney(remaining)}
        </Button>
      </div>
    </div>
  );
}

function GiftCardPane({ orderId, busy, setBusy, setError, onBack, onResult }: PaneProps) {
  const [code, setCode] = useState('');
  const [remainderNote, setRemainderNote] = useState<string | null>(null);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    setRemainderNote(null);
    const res = await fetch(`/api/pos/orders/${orderId}/payments/gift-card`, {
      method: 'POST',
      headers: JSON_HEADERS,
      // Send a very large amountCents; the server clamps to the order's
      // remaining balance and the gift card's own balance.
      body: JSON.stringify({ code: code.trim(), amountCents: Number.MAX_SAFE_INTEGER }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        order: PosOrder;
        amountApplied: number;
        giftCardRemainingCents: number;
      };
      setCode('');
      if (remainingBalanceCents(data.order) > 0) {
        setRemainderNote(
          `Applied ${formatMoney(data.amountApplied)}. Gift card balance is now ${formatMoney(data.giftCardRemainingCents)}.`,
        );
      }
      onResult(data.order);
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Failed to apply gift card'));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">Gift card code</Label>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCD1234EFGH"
        className="min-h-11 text-base"
        autoFocus
      />
      {remainderNote && <p className="text-sm text-muted-foreground">{remainderNote}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button className="min-h-11 flex-1" onClick={submit} disabled={busy || !code.trim()}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function CompPane({
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
