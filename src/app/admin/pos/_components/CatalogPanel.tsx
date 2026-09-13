'use client';

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FiringPanel } from './FiringPanel';
import { dropInSessionIdOf, formatMoney, type PosCatalog, type PosOrder } from './types';

// Memberships are sold online only until Oct 25, so there's no Memberships
// tab. The server still accepts MEMBERSHIP items.
type TabId = 'RETAIL' | 'DROP_IN' | 'GIFT_CARD' | 'FIRING' | 'CUSTOM';

const TABS: { id: TabId; label: string }[] = [
  { id: 'RETAIL', label: 'Retail' },
  { id: 'DROP_IN', label: 'Drop-ins' },
  { id: 'GIFT_CARD', label: 'Gift Card' },
  { id: 'FIRING', label: 'Clay & firing' },
  { id: 'CUSTOM', label: 'Custom' },
];

const GIFT_CARD_PRESETS = [2500, 5000, 10000];
const DROP_IN_DAYS = 7;

function dayKey(date: Date | string): string {
  return formatInTimeZone(date, STUDIO_TIMEZONE, 'yyyy-MM-dd');
}

interface CatalogPanelProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  onAddOrIncrement: (itemType: 'RETAIL', refId: string) => void;
  onAddDropIn: (studioSessionId: string) => void;
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
  onAddOrIncrement,
  onAddDropIn,
  onAddDistinct,
}: CatalogPanelProps) {
  const [tab, setTab] = useState<TabId>('RETAIL');
  const [retailSearch, setRetailSearch] = useState('');

  const [dropInDay, setDropInDay] = useState(() => dayKey(new Date()));

  const [giftAmountCents, setGiftAmountCents] = useState<number | null>(null);
  const [giftCustomAmount, setGiftCustomAmount] = useState('');
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientEmail, setGiftRecipientEmail] = useState('');

  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const filteredRetail = useMemo(() => {
    const products = catalog?.retailProducts ?? [];
    const q = retailSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, retailSearch]);

  // Today plus the next six Mountain Time days.
  const dropInDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: DROP_IN_DAYS }, (_, i) => {
      const date = addDays(now, i);
      return {
        key: dayKey(date),
        label: i === 0 ? 'Today' : formatInTimeZone(date, STUDIO_TIMEZONE, 'EEE d'),
      };
    });
  }, []);

  const sessionsForDay = useMemo(
    () => (catalog?.upcomingSessions ?? []).filter((s) => dayKey(s.startsAt) === dropInDay),
    [catalog, dropInDay],
  );

  const sessionsInCart = useMemo(
    () =>
      new Set(
        (order?.items ?? [])
          .filter((i) => i.itemType === 'DROP_IN')
          .map(dropInSessionIdOf)
          .filter((id): id is string => id !== null),
      ),
    [order],
  );

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

      {/* Drop-ins: a seat in a real session at this studio */}
      {tab === 'DROP_IN' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {dropInDays.map((d) => (
              <Button
                key={d.key}
                variant={dropInDay === d.key ? 'default' : 'outline'}
                className="min-h-11"
                onClick={() => setDropInDay(d.key)}
              >
                {d.label}
              </Button>
            ))}
          </div>

          <div className="divide-y rounded-lg border">
            {sessionsForDay.map((s) => {
              const seatsLeft = Math.max(0, s.capacity - s.confirmedCount);
              const full = seatsLeft === 0;
              const inCart = sessionsInCart.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy || !order || full || inCart}
                  onClick={() => onAddDropIn(s.id)}
                  className={cn(
                    'flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left',
                    full || inCart ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted active:bg-muted',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatInTimeZone(s.startsAt, STUDIO_TIMEZONE, 'h:mm a')} · {s.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {s.instructorName ? `${s.instructorName} · ` : ''}
                      {inCart ? 'In this order' : full ? 'Full' : `${seatsLeft} of ${s.capacity} seats left`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold">{formatMoney(s.dropInPriceCents)}</span>
                </button>
              );
            })}
            {sessionsForDay.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No sessions at this studio on this day.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A drop-in books a seat for the customer on this order, so attach the customer before charging.
          </p>
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

      {/* Clay & firing */}
      {tab === 'FIRING' && <FiringPanel order={order} busy={busy} onAdd={onAddDistinct} />}

      {/* Custom */}
      {tab === 'CUSTOM' && (
        <div className="flex flex-col gap-3">
          <div>
            <Label className="text-sm font-medium">Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Item name"
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
