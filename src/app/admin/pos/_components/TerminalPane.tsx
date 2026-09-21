'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, formatMoney, type ApiErrorBody, type PosOrder } from './types';
import type { ReaderStatus } from './payment/useReaderStatus';

/**
 * Card payment on a Stripe Terminal reader (BBPOS WisePOS E).
 *
 * Server-driven: we hand the PaymentIntent to the reader and then poll for the
 * result while the customer taps and picks a tip on the device. Nothing about
 * the card is ever handled in this browser.
 *
 * The reader itself is chosen (and watched) in the order panel, so opening
 * this pane sends the payment straight to it; the list below is only the
 * fallback when that attempt fails.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const POLL_MS = 1200;
/** Give up polling well after the reader's own ~60s prompt timeout. */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type Phase = 'choosing' | 'waiting';

interface Props {
  orderId: string;
  remaining: number;
  reader: ReaderStatus;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onResult: (order: PosOrder) => void;
  /** True while the reader is prompting for a card, so the sheet can go full width and stay open. */
  onWaitingChange?: (waiting: boolean) => void;
}

export function TerminalPane({
  orderId,
  remaining,
  reader,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
  onWaitingChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>('choosing');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Poll loop is cancelled on unmount so closing the sheet mid-payment doesn't
  // leave a timer running against a dialog that's gone.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    onWaitingChange?.(phase === 'waiting');
  }, [phase, onWaitingChange]);
  useEffect(() => () => onWaitingChange?.(false), [onWaitingChange]);

  const poll = useCallback(
    async (pid: string) => {
      const startedAt = Date.now();
      while (!cancelled.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancelled.current) return;

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setError('The reader timed out. Cancel and try again.');
          return;
        }

        let data: {
          state?: string;
          message?: string;
          order?: PosOrder;
          error?: string;
        };
        try {
          const res = await fetch(
            `/api/pos/orders/${orderId}/payments/${pid}/terminal-status`,
          );
          data = await res.json();
          if (!res.ok) {
            setError(apiErrorMessage(data, 'Lost contact with the reader.'));
            setBusy(false);
            setPhase('choosing');
            return;
          }
        } catch {
          // A single dropped request mid-payment is not fatal — keep polling.
          continue;
        }

        if (data.state === 'succeeded' && data.order) {
          setBusy(false);
          onResult(data.order);
          return;
        }
        if (data.state === 'failed') {
          setError(data.message ?? 'The payment was declined.');
          setBusy(false);
          setPhase('choosing');
          setPaymentId(null);
          return;
        }
        // in_progress — keep waiting.
      }
    },
    [orderId, onResult, setBusy, setError],
  );

  const start = useCallback(
    async (readerId: string) => {
      if (!readerId) return;
      setError(null);
      setBusy(true);
      setStarting(true);
      try {
        const res = await fetch(`/api/pos/orders/${orderId}/payments/card-terminal`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ amountCents: remaining, readerId }),
        });
        const data = (await res.json()) as ApiErrorBody & { paymentId?: string };
        if (!res.ok || !data.paymentId) {
          setError(apiErrorMessage(data, 'Could not start the payment.'));
          setBusy(false);
          return;
        }
        setPaymentId(data.paymentId);
        setPhase('waiting');
        void poll(data.paymentId);
      } catch {
        setError('Could not reach the reader.');
        setBusy(false);
      } finally {
        setStarting(false);
      }
    },
    [orderId, remaining, poll, setBusy, setError],
  );

  // Send to the chosen reader as soon as the pane opens: one tap from the
  // tender sheet to the reader asking for a card. The ref keeps React's
  // development double-mount from starting two payments.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    if (reader.ready && reader.selected) void start(reader.selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  async function cancel() {
    if (!paymentId) {
      setPhase('choosing');
      return;
    }
    cancelled.current = true;
    setCancelling(true);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pos/orders/${orderId}/payments/${paymentId}/terminal-cancel`,
        { method: 'POST', headers: JSON_HEADERS },
      );
      const data = await res.json();
      // The customer may have completed the tap in the moment we pressed cancel.
      if (data.state === 'succeeded' && data.order) {
        onResult(data.order);
        return;
      }
      setError(null);
    } catch {
      setError('Could not cancel on the reader — check the device.');
    } finally {
      cancelled.current = false;
      setCancelling(false);
      setBusy(false);
      setPhase('choosing');
      setPaymentId(null);
    }
  }

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 px-4 py-10 text-center">
          <span
            aria-hidden
            className="size-10 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-foreground"
          />
          <p className="text-5xl font-bold tracking-tight">{formatMoney(remaining)}</p>
          <p className="text-xl font-medium">Waiting for card on {reader.selected?.label ?? 'the reader'}</p>
          <p className="text-muted-foreground">
            Tap, insert or swipe. They&apos;ll be asked about a tip before paying.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-16 w-full border-2 border-destructive text-xl font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={cancel}
          disabled={cancelling}
        >
          {cancelling ? 'Cancelling…' : 'Cancel payment'}
        </Button>
      </div>
    );
  }

  const readers = reader.readers ?? [];

  return (
    <div className="flex flex-col gap-3 py-2">
      {starting && <p className="text-sm text-muted-foreground">Sending {formatMoney(remaining)} to the reader…</p>}

      {!starting && reader.readers === null && (
        <p className="text-sm text-muted-foreground">Looking for readers…</p>
      )}

      {!starting && reader.readers !== null && !reader.ready && reader.reason && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {reader.reason}
        </p>
      )}

      {!starting && readers.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">Send to reader</p>
          <div className="flex flex-col gap-2">
            {readers.map((r) => {
              const offline = r.status !== 'online';
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => reader.chooseReader(r.id)}
                  disabled={offline || busy}
                  aria-pressed={r.id === reader.readerId}
                  className={`flex min-h-11 items-center justify-between rounded-md border px-3 py-3 text-left text-sm disabled:opacity-50 ${
                    r.id === reader.readerId ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.deviceType}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {offline ? 'Offline' : r.busy ? 'In use' : 'Ready'}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            className="min-h-14 text-base"
            onClick={() => void start(reader.readerId)}
            disabled={busy || !reader.ready}
          >
            Charge {formatMoney(remaining)} on the reader
          </Button>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="min-h-11 flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          onClick={() => void reader.refresh()}
          disabled={busy || reader.checking}
        >
          {reader.checking ? 'Checking…' : 'Check readers again'}
        </Button>
      </div>
    </div>
  );
}
