'use client';

import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, formatMoney, type ApiErrorBody, type PosOrder } from '../types';
import { JSON_HEADERS, type PaneProps } from './paneTypes';

/** Typed-in card: phone orders, and the fallback when the reader is offline. Wrap in <Elements>. */
export function CardPane({
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
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    setError(apiErrorMessage(data, 'Could not confirm the card payment'));
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
