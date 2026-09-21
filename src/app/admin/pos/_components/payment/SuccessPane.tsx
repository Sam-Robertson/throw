'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatGiftCardCode } from '@/lib/giftCardCode';
import { realEmail } from '@/lib/walkinEmail';
import {
  apiErrorMessage,
  formatMoney,
  giftCardCodesFromOrder,
  type ApiErrorBody,
  type PosOrder,
} from '../types';
import { JSON_HEADERS } from './paneTypes';

type Channel = 'email' | 'sms' | 'none';

interface SuccessPaneProps {
  order: PosOrder;
  /** The attached customer's phone (the order only carries name and email). */
  customerPhone: string | null;
  onNewOrder: () => void;
}

const CHANNEL_LABELS: Record<Channel, string> = { email: 'Email', sms: 'Text', none: 'None' };

/**
 * Paid. Pick how the receipt goes (Email, Text or None), then New order.
 *
 * Email is preselected when the customer has an address on file, so the
 * common case is one tap on New order: whatever is selected and not yet sent
 * goes out then. The choice is reported to the server either way, which
 * cancels the delayed automatic email so nobody gets two receipts.
 */
export function SuccessPane({ order, customerPhone, onNewOrder }: SuccessPaneProps) {
  const emailOnFile = realEmail(order.customer?.email);
  const phoneOnFile = customerPhone ?? order.walkInPhone ?? '';

  const [channel, setChannel] = useState<Channel>(emailOnFile ? 'email' : 'none');
  const [email, setEmail] = useState(emailOnFile ?? '');
  const [phone, setPhone] = useState(phoneOnFile);
  const [sending, setSending] = useState(false);
  // `typed` is what was in the box when it went, so editing the address re-arms the send.
  const [sent, setSent] = useState<{ channel: Channel; typed: string; to: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The customer's phone arrives a moment after the sheet opens.
  const phoneTouched = useRef(false);
  useEffect(() => {
    if (!phoneTouched.current) setPhone(phoneOnFile);
  }, [phoneOnFile]);

  const to = channel === 'email' ? email.trim() : channel === 'sms' ? phone.trim() : '';
  const alreadySent = sent?.channel === channel && sent.typed === to;

  async function send(): Promise<boolean> {
    if (channel !== 'none' && !to) {
      setError(channel === 'email' ? 'Enter an email address, or choose None.' : 'Enter a mobile number, or choose None.');
      return false;
    }
    setSending(true);
    setError(null);
    const res = await fetch(`/api/pos/orders/${order.id}/receipt`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ channel, to: to || undefined }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as ApiErrorBody) : {};
      setError(apiErrorMessage(data, 'Could not send the receipt'));
      return false;
    }
    const data = (await res.json()) as { sent: Channel; to: string | null };
    setSent({ channel, typed: to, to: data.to ?? to });
    return true;
  }

  async function newOrder() {
    // Anything selected but not yet sent goes out now. After a failure the
    // error stays up and a second tap moves on without the receipt.
    if (!alreadySent && !error && !(await send())) return;
    onNewOrder();
  }

  const giftCards = giftCardCodesFromOrder(order);

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col items-center gap-1 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700"
        >
          ✓
        </span>
        <p className="text-2xl font-bold">{formatMoney(order.totalCents)} paid</p>
        <p className="text-sm text-muted-foreground">
          Order #{order.orderNumber}
          {order.tipCents > 0 ? ` · includes ${formatMoney(order.tipCents)} tip` : ''}
        </p>
      </div>

      {giftCards.length > 0 && (
        <div className="w-full rounded-lg border-2 border-foreground p-4 text-left">
          <p className="text-sm font-semibold">Gift card codes. Give these to the customer.</p>
          {giftCards.map((g) =>
            g.codes.map((code) => (
              <div key={code} className="mt-2 flex items-center justify-between gap-3">
                <span className="break-all font-mono text-2xl font-bold tracking-widest">
                  {formatGiftCardCode(code)}
                </span>
                <span className="text-sm text-muted-foreground">{formatMoney(g.amountCents)}</span>
              </div>
            )),
          )}
        </div>
      )}

      {order.note && (
        <p className="w-full whitespace-pre-line rounded-md border bg-muted/40 p-2 text-left text-sm">{order.note}</p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Receipt</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Receipt">
          {(['email', 'sms', 'none'] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              onClick={() => {
                setChannel(c);
                setError(null);
              }}
              disabled={sending}
              className={`min-h-14 rounded-md border text-base font-medium ${
                channel === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              {CHANNEL_LABELS[c]}
            </button>
          ))}
        </div>

        {channel !== 'none' && (
          <div className="flex gap-2">
            {channel === 'email' ? (
              <Input
                type="email"
                inputMode="email"
                aria-label="Email address for the receipt"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 text-base"
              />
            ) : (
              <Input
                type="tel"
                inputMode="tel"
                aria-label="Mobile number for the receipt"
                placeholder="Mobile number"
                value={phone}
                onChange={(e) => {
                  phoneTouched.current = true;
                  setPhone(e.target.value);
                  setError(null);
                }}
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 text-base"
              />
            )}
            <Button
              variant="outline"
              className="min-h-11 shrink-0"
              onClick={() => void send()}
              disabled={sending || !to}
            >
              {sending ? 'Sending…' : 'Send now'}
            </Button>
          </div>
        )}

        {sent && sent.channel !== 'none' && (
          <p className="text-sm text-green-700">
            Receipt {sent.channel === 'email' ? 'emailed' : 'texted'} to {sent.to}.
          </p>
        )}
        {!alreadySent && !error && channel !== 'none' && to && (
          <p className="text-sm text-muted-foreground">
            Will be {channel === 'email' ? 'emailed' : 'texted'} to {to} when you tap New order.
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error} Tap New order again to go on without it.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="min-h-16 px-5" onClick={() => window.print()}>
          Print
        </Button>
        <Button className="min-h-16 flex-1 text-xl font-semibold" onClick={() => void newOrder()} disabled={sending}>
          {sending ? 'Sending receipt…' : 'New order'}
        </Button>
      </div>
    </div>
  );
}
