'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMountainTime } from '@/lib/timezone';
import { realEmail } from '@/lib/walkinEmail';
import {
  apiErrorMessage,
  formatMoney,
  type ApiErrorBody,
  type CustomerSummary,
  type PosCatalog,
  type PosOrder,
} from '../types';

interface CustomerMatch {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
}

type Mode = 'walkin' | 'search' | 'new';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface CustomerPanelProps {
  order: PosOrder | null;
  /** Class types, to say what a booking's quantity counts (wheels or people). */
  catalog?: PosCatalog | null;
  busy: boolean;
  onAttachCustomer: (customerId: string | null) => void;
  /** For the walk-in name and phone, saved straight to the order. */
  onOrderUpdate: (order: PosOrder) => void;
}

/** "Clay Together, 7:00 PM, 2 wheels" */
function bookingLine(b: CustomerSummary['todaysBookings'][number], catalog?: PosCatalog | null): string {
  const time = formatMountainTime(new Date(b.startsAt), 'time');
  const priceUnit = catalog?.sessionTypes.find((t) => t.id === b.sessionTypeId)?.priceUnit;
  const unit = priceUnit === 'PER_WHEEL' ? 'wheel' : priceUnit === 'PER_PERSON' ? 'person' : 'spot';
  const plural = unit === 'person' ? 'people' : `${unit}s`;
  const seats = priceUnit === 'FLAT' ? '' : `, ${b.quantity} ${b.quantity === 1 ? unit : plural}`;
  return `${b.name}, ${time}${seats}${b.status === 'WAITLIST' ? ' (waitlist)' : ''}`;
}

export function CustomerPanel({ order, catalog, busy, onAttachCustomer, onOrderUpdate }: CustomerPanelProps) {
  // Walk-in is the explicit default: most sales have no account behind them.
  const [mode, setMode] = useState<Mode>('walkin');

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInError, setWalkInError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [existingMatch, setExistingMatch] = useState<CustomerMatch | null>(null);

  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [waiverBusy, setWaiverBusy] = useState(false);
  const [waiverNotice, setWaiverNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const orderId = order?.id ?? null;
  const customerId = order?.customerId ?? null;
  const locationId = order?.locationId ?? null;
  const orderStatus = order?.status ?? null;

  // A new order starts back at walk-in with that order's saved walk-in details.
  useEffect(() => {
    setMode('walkin');
    setCustomerQuery('');
    setNewError(null);
    setExistingMatch(null);
    setWalkInError(null);
  }, [orderId]);
  useEffect(() => {
    setWalkInName(order?.walkInName ?? '');
    setWalkInPhone(order?.walkInPhone ?? '');
  }, [orderId, order?.walkInName, order?.walkInPhone]);

  // Debounced customer typeahead search.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!customerQuery.trim()) {
      setCustomerMatches([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(customerQuery.trim())}`).catch(
        () => null,
      );
      if (res?.ok) setCustomerMatches((await res.json()) as CustomerMatch[]);
      setSearching(false);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [customerQuery]);

  // What the register should know about the attached customer. Reloaded when
  // the customer changes and when the order completes (credit, tickets and
  // gift card balances may just have been spent).
  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setWaiverNotice(null);
    if (!customerId || !locationId) return;
    let cancelled = false;
    fetch(`/api/pos/customers/${customerId}/summary?locationId=${locationId}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) setSummary((await r.json()) as CustomerSummary);
        else {
          const data = (await r.json().catch(() => ({}))) as ApiErrorBody;
          setSummaryError(apiErrorMessage(data, 'Could not load this customer’s details'));
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryError('Could not load this customer’s details');
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, locationId, orderStatus]);

  function selectCustomer(id: string) {
    setCustomerQuery('');
    setCustomerMatches([]);
    setExistingMatch(null);
    setNewError(null);
    onAttachCustomer(id);
  }

  async function saveWalkIn() {
    if (!order || order.customerId) return;
    const name = walkInName.trim();
    const phone = walkInPhone.trim();
    if (name === (order.walkInName ?? '') && phone === (order.walkInPhone ?? '')) return;
    setWalkInError(null);
    const res = await fetch(`/api/pos/orders/${order.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ walkInName: name || null, walkInPhone: phone || null }),
    }).catch(() => null);
    if (res?.ok) onOrderUpdate((await res.json()) as PosOrder);
    else {
      const data = res ? ((await res.json().catch(() => ({}))) as ApiErrorBody) : {};
      setWalkInError(apiErrorMessage(data, 'Could not save the walk-in details'));
    }
  }

  async function createCustomer() {
    if (!order) return;
    setCreating(true);
    setNewError(null);
    setExistingMatch(null);
    const res = await fetch('/api/pos/customers', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        locationId: order.locationId,
      }),
    }).catch(() => null);
    setCreating(false);
    if (!res) {
      setNewError('Could not reach the server. Check the connection and try again.');
      return;
    }
    if (res.ok) {
      const created = (await res.json()) as CustomerMatch;
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      selectCustomer(created.id);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & { customer?: CustomerMatch };
    setNewError(apiErrorMessage(data, 'Could not create the customer'));
    if (data.customer) setExistingMatch(data.customer);
  }

  async function sendWaiver() {
    if (!customerId || !locationId) return;
    setWaiverBusy(true);
    setWaiverNotice(null);
    const res = await fetch(`/api/pos/customers/${customerId}/send-waiver`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ locationId }),
    }).catch(() => null);
    setWaiverBusy(false);
    if (res?.ok) {
      const data = (await res.json()) as { channel: string; to: string };
      setWaiverNotice({
        ok: true,
        text: `Waiver link ${data.channel === 'sms' ? 'texted' : 'emailed'} to ${data.to}.`,
      });
    } else {
      const data = res ? ((await res.json().catch(() => ({}))) as ApiErrorBody) : {};
      setWaiverNotice({ ok: false, text: apiErrorMessage(data, 'Could not send the waiver link') });
    }
  }

  // ── Customer attached ──────────────────────────────────────────────────────
  if (order?.customerId && order.customer) {
    const email = realEmail(order.customer.email);
    const membership = summary?.membership ?? null;
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</h3>
            <p className="truncate text-lg font-semibold">{order.customer.name ?? email ?? 'Customer'}</p>
            <p className="truncate text-sm text-muted-foreground">
              {[email, summary?.customer.phone].filter(Boolean).join(' · ') || 'No email on file'}
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => onAttachCustomer(null)}
            disabled={busy}
            aria-label="Remove customer from this order"
          >
            Remove
          </Button>
        </div>

        {summaryError && <p className="mt-2 text-sm text-destructive">{summaryError}</p>}
        {!summary && !summaryError && <p className="mt-2 text-sm text-muted-foreground">Loading details…</p>}

        {summary && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {membership ? (
                <Badge
                  className={
                    membership.status === 'ACTIVE'
                      ? 'border-green-200 bg-green-100 text-green-800'
                      : 'border-amber-200 bg-amber-100 text-amber-800'
                  }
                >
                  {membership.planName} · {membership.status === 'ACTIVE' ? 'Active' : 'Paused'}
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground">No membership</Badge>
              )}
              {summary.waiverOnFile && (
                <Badge className="border-green-200 bg-green-100 text-green-800">Waiver on file</Badge>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {summary.tickets && (
                <div>
                  <dt className="text-muted-foreground">Class tickets</dt>
                  <dd className="font-medium">
                    {summary.tickets.unlimited ? 'Unlimited' : (summary.tickets.remaining ?? 0)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Class pack credits</dt>
                <dd className="font-medium">{summary.classPackCredits}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account credit</dt>
                <dd className="font-medium">{formatMoney(summary.accountCreditCents)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gift card balance</dt>
                <dd className="font-medium">{formatMoney(summary.giftCardBalanceCents)}</dd>
              </div>
            </dl>

            <div className="mt-3 text-sm">
              <p className="text-muted-foreground">Today</p>
              {summary.todaysBookings.length === 0 ? (
                <p>No bookings today at this studio.</p>
              ) : (
                <ul className="font-medium">
                  {summary.todaysBookings.map((b) => (
                    <li key={b.id}>{bookingLine(b, catalog)}</li>
                  ))}
                </ul>
              )}
            </div>

            {!summary.waiverOnFile && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">No signed waiver on file for this studio.</p>
                <p>They need to sign before using the studio.</p>
                <Button
                  variant="outline"
                  className="mt-2 min-h-11 w-full border-amber-400 bg-white"
                  onClick={sendWaiver}
                  disabled={waiverBusy}
                >
                  {waiverBusy ? 'Sending…' : 'Send waiver link'}
                </Button>
              </div>
            )}
            {waiverNotice && (
              <p className={`mt-2 text-sm ${waiverNotice.ok ? 'text-green-700' : 'text-destructive'}`}>
                {waiverNotice.text}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ── No customer: walk-in (default), find, or new ───────────────────────────
  const tabs: { id: Mode; label: string }[] = [
    { id: 'walkin', label: 'Walk-in' },
    { id: 'search', label: 'Find customer' },
    { id: 'new', label: 'New customer' },
  ];
  const canCreate = !!newName.trim() && (!!newEmail.trim() || !!newPhone.trim());

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</h3>

      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Who is this order for?">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            disabled={busy && mode !== t.id}
            className={`min-h-11 rounded-md border px-2 text-sm font-medium ${
              mode === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-muted'
            }`}
          >
            {mode === t.id && t.id === 'walkin' ? '✓ ' : ''}
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'walkin' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">Walk-in</span>
            <span className="text-muted-foreground"> · no account on this order</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Walk-in name (optional)"
              placeholder="Name (optional)"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              onBlur={saveWalkIn}
              disabled={!order}
              className="min-h-11 text-base"
            />
            <Input
              aria-label="Walk-in phone (optional)"
              placeholder="Phone (optional)"
              inputMode="tel"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              onBlur={saveWalkIn}
              disabled={!order}
              className="min-h-11 text-base"
            />
          </div>
          {walkInError && <p className="text-sm text-destructive">{walkInError}</p>}
        </div>
      )}

      {mode === 'search' && (
        <div className="mt-3 space-y-2">
          <Input
            autoFocus
            placeholder="Search by name or email…"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            className="min-h-11 text-base"
          />
          {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
          {!searching && customerQuery.trim() && customerMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">No one found. Try “New customer”.</p>
          )}
          {customerMatches.length > 0 && (
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {customerMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCustomer(c.id)}
                  disabled={busy}
                  className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="font-medium">{c.name ?? c.email}</span>
                  <span className="text-sm text-muted-foreground">{realEmail(c.email) ?? 'No email on file'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pos-new-name" className="text-sm">
              Name
            </Label>
            <Input
              id="pos-new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoComplete="off"
              className="min-h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pos-new-email" className="text-sm">
              Email
            </Label>
            <Input
              id="pos-new-email"
              type="email"
              inputMode="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="off"
              className="min-h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pos-new-phone" className="text-sm">
              Phone
            </Label>
            <Input
              id="pos-new-phone"
              type="tel"
              inputMode="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              autoComplete="off"
              className="min-h-11 text-base"
            />
          </div>
          <p className="text-xs text-muted-foreground">Name plus an email or a phone number.</p>
          {newError && <p className="text-sm text-destructive">{newError}</p>}
          {existingMatch && (
            <Button
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => selectCustomer(existingMatch.id)}
              disabled={busy}
            >
              Attach {existingMatch.name ?? realEmail(existingMatch.email) ?? 'existing customer'}
            </Button>
          )}
          <Button className="min-h-11 w-full" onClick={createCustomer} disabled={busy || creating || !canCreate}>
            {creating ? 'Creating…' : 'Create and attach'}
          </Button>
        </div>
      )}
    </div>
  );
}
