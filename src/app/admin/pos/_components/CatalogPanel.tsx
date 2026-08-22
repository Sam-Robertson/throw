'use client';

import { useEffect, useMemo, useState } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatMoney, type PosCatalog, type PosOrder } from './types';

interface TodaySession {
  id: string;
  startsAt: string;
  locationId: string;
  sessionType: { name: string };
  instructor: { name: string | null } | null;
}

type TabId = 'RETAIL' | 'DROP_IN' | 'MEMBERSHIP' | 'GIFT_CARD' | 'CUSTOM';

const TABS: { id: TabId; label: string }[] = [
  { id: 'RETAIL', label: 'Retail' },
  { id: 'DROP_IN', label: 'Drop-ins' },
  { id: 'MEMBERSHIP', label: 'Memberships' },
  { id: 'GIFT_CARD', label: 'Gift Card' },
  { id: 'CUSTOM', label: 'Custom' },
];

const GIFT_CARD_PRESETS = [2500, 5000, 10000];

interface CatalogPanelProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  locationId: string;
  onAddOrIncrement: (itemType: 'RETAIL' | 'DROP_IN' | 'MEMBERSHIP', refId: string, metadata?: Record<string, unknown>) => void;
  onAddDistinct: (payload: {
    itemType: 'GIFT_CARD' | 'CUSTOM';
    name?: string;
    unitPriceCents: number;
    metadata?: Record<string, unknown>;
  }) => void;
}

export function CatalogPanel({
  catalog,
  order,
  busy,
  locationId,
  onAddOrIncrement,
  onAddDistinct,
}: CatalogPanelProps) {
  const [tab, setTab] = useState<TabId>('RETAIL');
  const [retailSearch, setRetailSearch] = useState('');

  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [giftAmountCents, setGiftAmountCents] = useState<number | null>(null);
  const [giftCustomAmount, setGiftCustomAmount] = useState('');
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientEmail, setGiftRecipientEmail] = useState('');

  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    if (tab !== 'DROP_IN' || !locationId) return;
    const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
    const from = fromZonedTime(startOfDay(nowMT), STUDIO_TIMEZONE);
    const to = fromZonedTime(endOfDay(nowMT), STUDIO_TIMEZONE);
    fetch(`/api/admin/studio-sessions?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((sessions: TodaySession[]) =>
        setTodaySessions(sessions.filter((s) => s.locationId === locationId)),
      );
  }, [tab, locationId]);

  const filteredRetail = useMemo(() => {
    const products = catalog?.retailProducts ?? [];
    const q = retailSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, retailSearch]);

  function submitGiftCard() {
    const cents = giftAmountCents ?? Math.round(parseFloat(giftCustomAmount || '0') * 100);
    if (!cents || cents <= 0) return;
    onAddDistinct({
      itemType: 'GIFT_CARD',
      unitPriceCents: cents,
      metadata: {
        recipientName: giftRecipientName.trim() || undefined,
        recipientEmail: giftRecipientEmail.trim() || undefined,
      },
    });
    setGiftAmountCents(null);
    setGiftCustomAmount('');
    setGiftRecipientName('');
    setGiftRecipientEmail('');
  }

  function submitCustom() {
    const cents = Math.round(parseFloat(customAmount || '0') * 100);
    if (!customName.trim() || !cents || cents <= 0) return;
    onAddDistinct({ itemType: 'CUSTOM', name: customName.trim(), unitPriceCents: cents });
    setCustomName('');
    setCustomAmount('');
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-11 rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Retail */}
      {tab === 'RETAIL' && (
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Search products…"
            value={retailSearch}
            onChange={(e) => setRetailSearch(e.target.value)}
            className="min-h-11 text-base"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRetail.map((product) => {
              const outOfStock = product.stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={outOfStock || busy || !order}
                  onClick={() => onAddOrIncrement('RETAIL', product.id)}
                  className={cn(
                    'min-h-24 rounded-lg border p-4 text-left transition-colors',
                    outOfStock
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:border-primary hover:bg-muted active:bg-muted',
                  )}
                >
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(product.priceCents)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                  </p>
                </button>
              );
            })}
            {filteredRetail.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">No products match.</p>
            )}
          </div>
        </div>
      )}

      {/* Drop-ins */}
      {tab === 'DROP_IN' && (
        <div className="flex flex-col gap-3">
          <div className="divide-y rounded-lg border">
            {(catalog?.sessionTypes ?? []).map((st) => (
              <button
                key={st.id}
                type="button"
                disabled={busy || !order}
                onClick={() =>
                  onAddOrIncrement(
                    'DROP_IN',
                    st.id,
                    selectedSessionId ? { studioSessionId: selectedSessionId } : undefined,
                  )
                }
                className="flex min-h-14 w-full items-center justify-between px-4 py-2 text-left hover:bg-muted active:bg-muted"
              >
                <span className="font-medium">{st.name}</span>
                <span className="font-semibold">{formatMoney(st.dropInPriceCents)}</span>
              </button>
            ))}
            {(catalog?.sessionTypes ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No session types available.</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3">
            <Label className="text-sm font-medium">Tie this to a session (optional)</Label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              <option value="">No specific session</option>
              {todaySessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startsAt).toLocaleTimeString('en-US', {
                    timeZone: STUDIO_TIMEZONE,
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  — {s.sessionType.name}
                  {s.instructor?.name ? ` (${s.instructor.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Memberships */}
      {tab === 'MEMBERSHIP' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Memberships sold here create a one time charge. Set up recurring billing from the
            customer&apos;s profile after checkout.
          </div>
          <div className="divide-y rounded-lg border">
            {(catalog?.membershipPlans ?? []).map((plan) => (
              <button
                key={plan.id}
                type="button"
                disabled={busy || !order}
                onClick={() => onAddOrIncrement('MEMBERSHIP', plan.id)}
                className="flex min-h-14 w-full items-center justify-between px-4 py-2 text-left hover:bg-muted active:bg-muted"
              >
                <div>
                  <span className="font-medium">{plan.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    every {plan.billingIntervalDays} days
                  </span>
                </div>
                <span className="font-semibold">{formatMoney(plan.priceInCents)}</span>
              </button>
            ))}
            {(catalog?.membershipPlans ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No membership plans available.</p>
            )}
          </div>
        </div>
      )}

      {/* Gift Card */}
      {tab === 'GIFT_CARD' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {GIFT_CARD_PRESETS.map((cents) => (
              <Button
                key={cents}
                variant={giftAmountCents === cents ? 'default' : 'outline'}
                className="min-h-11 flex-1"
                onClick={() => {
                  setGiftAmountCents(cents);
                  setGiftCustomAmount('');
                }}
              >
                {formatMoney(cents)}
              </Button>
            ))}
          </div>
          <div>
            <Label className="text-sm font-medium">Custom amount</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={giftCustomAmount}
              onChange={(e) => {
                setGiftCustomAmount(e.target.value);
                setGiftAmountCents(null);
              }}
              className="mt-1 min-h-11 text-base"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Recipient name (optional)</Label>
              <Input
                value={giftRecipientName}
                onChange={(e) => setGiftRecipientName(e.target.value)}
                className="mt-1 min-h-11 text-base"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Recipient email (optional)</Label>
              <Input
                type="email"
                value={giftRecipientEmail}
                onChange={(e) => setGiftRecipientEmail(e.target.value)}
                className="mt-1 min-h-11 text-base"
              />
            </div>
          </div>
          <Button
            className="min-h-11"
            disabled={busy || !order || (!giftAmountCents && !giftCustomAmount)}
            onClick={submitGiftCard}
          >
            Add to cart
          </Button>
        </div>
      )}

      {/* Custom */}
      {tab === 'CUSTOM' && (
        <div className="flex flex-col gap-3">
          <div>
            <Label className="text-sm font-medium">Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Firing fee"
              className="mt-1 min-h-11 text-base"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Amount</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="mt-1 min-h-11 text-base"
            />
          </div>
          <Button
            className="min-h-11"
            disabled={busy || !order || !customName.trim() || !customAmount}
            onClick={submitCustom}
          >
            Add to cart
          </Button>
        </div>
      )}
    </div>
  );
}
