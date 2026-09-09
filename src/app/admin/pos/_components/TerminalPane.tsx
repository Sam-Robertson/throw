'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatMoney, type PosOrder } from './types';

/**
 * Card payment on a Stripe Terminal reader (BBPOS WisePOS E).
 *
 * Server-driven: we hand the PaymentIntent to the reader and then poll for the
 * result while the customer taps and picks a tip on the device. Nothing about
 * the card is ever handled in this browser.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const POLL_MS = 1200;
/** Give up polling well after the reader's own ~60s prompt timeout. */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const LAST_READER_KEY = 'pos.lastReaderId';

type Reader = {
  id: string;
  label: string;
  deviceType: string;
  status: string;
  busy: boolean;
};

type Phase = 'choosing' | 'waiting';

interface Props {
  orderId: string;
  locationId: string;
  remaining: number;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onResult: (order: PosOrder) => void;
}

export function TerminalPane({
  orderId,
  locationId,
  remaining,
  busy,
  setBusy,
  setError,
  onBack,
  onResult,
}: Props) {
  const [readers, setReaders] = useState<Reader[] | null>(null);
  const [readerId, setReaderId] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('choosing');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/pos/readers?locationId=${locationId}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error ?? 'Could not load card readers.');
          setReaders([]);
          return;
        }
        setReaders(data.readers ?? []);
        const remembered = window.localStorage.getItem(LAST_READER_KEY);
        const online = (data.readers as Reader[]).filter((r) => r.status === 'online');
        const preferred =
          online.find((r) => r.id === remembered) ?? online[0] ?? data.readers[0];
        if (preferred) setReaderId(preferred.id);
      } catch {
        if (active) {
          setError('Could not load card readers.');
          setReaders([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [locationId, setError]);

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
            setError(data.error ?? 'Lost contact with the reader.');
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

  async function start() {
    if (!readerId) return;
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/payments/card-terminal`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ amountCents: remaining, readerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start the payment.');
        setBusy(false);
        return;
      }
      window.localStorage.setItem(LAST_READER_KEY, readerId);
      setPaymentId(data.paymentId);
      setPhase('waiting');
      setNote('Follow the prompts on the reader.');
      void poll(data.paymentId);
    } catch {
      setError('Could not reach the reader.');
      setBusy(false);
    }
  }

  async function cancel() {
    if (!paymentId) {
      setPhase('choosing');
      return;
    }
    cancelled.current = true;
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
      setBusy(false);
      setPhase('choosing');
      setPaymentId(null);
    }
  }

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="bg-muted/40 flex flex-col items-center gap-2 rounded-md border p-6 text-center">
          <span
            aria-hidden
            className="border-muted-foreground/30 border-t-foreground size-8 animate-spin rounded-full border-2"
          />
          <p className="text-lg font-semibold">{formatMoney(remaining)}</p>
          <p className="text-muted-foreground text-sm">{note}</p>
          <p className="text-muted-foreground text-xs">
            They&apos;ll be asked about a tip before paying.
          </p>
        </div>
        <Button variant="outline" className="min-h-12" onClick={cancel} disabled={busy}>
          Cancel on reader
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {readers === null && (
        <p className="text-muted-foreground text-sm">Looking for readers…</p>
      )}

      {readers?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No card readers are registered to this studio yet. Add one in Studio setup →
          Card readers.
        </p>
      )}

      {readers && readers.length > 0 && (
        <>
          <p className="text-muted-foreground text-sm">Send to reader</p>
          <div className="flex flex-col gap-2">
            {readers.map((r) => {
              const offline = r.status !== 'online';
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReaderId(r.id)}
                  disabled={offline}
                  className={`flex items-center justify-between rounded-md border px-3 py-3 text-left text-sm disabled:opacity-50 ${
                    r.id === readerId ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {r.deviceType}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {offline ? 'Offline' : r.busy ? 'In use' : 'Ready'}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            className="min-h-14"
            onClick={start}
            disabled={busy || !readerId}
          >
            Charge {formatMoney(remaining)}
          </Button>
        </>
      )}

      <Button variant="ghost" className="min-h-11" onClick={onBack} disabled={busy}>
        Back
      </Button>
    </div>
  );
}
