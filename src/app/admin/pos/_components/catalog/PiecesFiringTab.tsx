'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { priceByWeight, quoteMemberFiring, type FiringPieceInput } from '@/lib/firing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  formatMoney,
  type CustomerSummary,
  type FiringRates,
  type PosCatalog,
  type PosOrder,
  type ProductCatalogItem,
} from '../types';

function parseWeight(text: string): number | null {
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "2 wheels" for a per-wheel class, "2 seats" otherwise; nothing for a single seat. */
function bookingQuantityLabel(quantity: number, priceUnit: string | undefined): string | null {
  if (priceUnit === 'PER_WHEEL') return `${quantity} wheel${quantity === 1 ? '' : 's'}`;
  return quantity > 1 ? `${quantity} seats` : null;
}

interface PiecesFiringTabProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  /** The attached customer's summary; null with no customer or while it loads. */
  summary: CustomerSummary | null;
  summaryLoading: boolean;
  onAddProduct: (product: ProductCatalogItem) => void;
  onAddByWeight: (productId: string, weightLb: number) => Promise<boolean>;
  onAddFiring: (pieces: FiringPieceInput[]) => Promise<boolean>;
}

export function PiecesFiringTab({
  catalog,
  order,
  busy,
  summary,
  summaryLoading,
  onAddProduct,
  onAddByWeight,
  onAddFiring,
}: PiecesFiringTabProps) {
  const products = useMemo(() => catalog?.products ?? [], [catalog]);
  const rates = catalog?.firingRates ?? null;

  const pieceButtons = products.filter((p) => p.category === 'PIECES' && p.unit === 'EACH');
  const piecesByWeight = products.filter((p) => p.category === 'PIECES' && p.unit === 'LB');
  // Bisque firing and anything else in FIRING that isn't one of the two per-lb rates.
  const firingExtras = products.filter(
    (p) =>
      p.category === 'FIRING' &&
      p.unit === 'EACH' &&
      p.id !== rates?.standardProductId &&
      p.id !== rates?.oversizeProductId,
  );
  const clayByWeight = products.filter((p) => p.category === 'CLAY' && p.unit === 'LB');
  const clayEach = products.filter((p) => p.category === 'CLAY' && p.unit === 'EACH');

  // Units of each product already on the order, shown on its button.
  const quantityOnOrder = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of order?.items ?? []) {
      if (item.itemType !== 'RETAIL' || !item.refId) continue;
      counts.set(item.refId, (counts.get(item.refId) ?? 0) + item.quantity);
    }
    return counts;
  }, [order]);

  const customerName = order?.customer ? (order.customer.name ?? order.customer.email) : null;
  const memberFiringBlock: string | null = !order?.customerId
    ? 'Attach a member or enrolled student to use member firing.'
    : summaryLoading || !summary
      ? 'Checking whether this customer can use member firing…'
      : !summary.canUseMemberFiring
        ? `${customerName ?? 'This customer'} isn't a member or enrolled student, so member firing is off.`
        : null;

  const priceUnitByType = useMemo(
    () => new Map((catalog?.sessionTypes ?? []).map((t) => [t.id, t.priceUnit])),
    [catalog],
  );
  const todaysBookings = order?.customerId ? (summary?.todaysBookings ?? []) : [];

  if (catalog && pieceButtons.length === 0 && piecesByWeight.length === 0 && !rates && clayByWeight.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        No piece, firing or clay products are set up yet.{' '}
        <NextLink href="/admin/studio-setup/products" className="font-medium text-foreground underline">
          Add them in Studio Set-up › Products
        </NextLink>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Today's booking: confirms staff attached the right person */}
      {todaysBookings.length > 0 && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-medium">{customerName ?? 'This customer'} is booked today</p>
          <ul className="mt-1">
            {todaysBookings.map((b) => {
              const qty = bookingQuantityLabel(
                b.quantity,
                b.sessionTypeId ? priceUnitByType.get(b.sessionTypeId) : undefined,
              );
              return (
                <li key={b.id}>
                  {b.name}, {formatInTimeZone(b.startsAt, STUDIO_TIMEZONE, 'h:mm a')}
                  {qty ? `, ${qty}` : ''}
                  {b.status === 'WAITLIST' ? ' (waitlist)' : ''}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pieces: one tap adds one, another tap adds another */}
      {(pieceButtons.length > 0 || piecesByWeight.length > 0) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Pieces</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {pieceButtons.map((p) => {
              const onOrder = quantityOnOrder.get(p.id) ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  // Not disabled while busy: taps are queued by the terminal, so
                  // "four 1 lb pieces" is four quick taps with none dropped.
                  disabled={!order}
                  onClick={() => onAddProduct(p)}
                  className={cn(
                    'relative min-h-20 rounded-lg border p-3 text-left transition-colors xl:p-4',
                    'hover:border-primary hover:bg-muted active:bg-muted disabled:opacity-60',
                    onOrder > 0 && 'border-foreground',
                  )}
                >
                  <p className="pr-8 font-medium leading-tight">{p.name}</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(p.priceCents)}</p>
                  {onOrder > 0 && (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                      {onOrder}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {piecesByWeight.map((p) => (
            <WeightAdd key={p.id} product={p} disabled={busy || !order} onAdd={onAddByWeight} />
          ))}
        </section>
      )}

      {/* Member firing, priced per piece by weight */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Member firing</h3>
        {!rates ? (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            Member firing isn&apos;t set up: the glaze firing products are missing, inactive or unpriced.{' '}
            <NextLink href="/admin/studio-setup/products" className="font-medium text-foreground underline">
              Check Products
            </NextLink>
            .
          </p>
        ) : (
          <FiringCalculator
            rates={rates}
            disabledReason={memberFiringBlock}
            busy={busy || !order}
            onSubmit={onAddFiring}
          />
        )}
        {firingExtras.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {firingExtras.map((p) => {
              const onOrder = quantityOnOrder.get(p.id) ?? 0;
              const blocked = p.membersOnly && memberFiringBlock !== null;
              return (
                <Button
                  key={p.id}
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || !order || blocked}
                  onClick={() => onAddProduct(p)}
                >
                  Add {p.name.toLowerCase()} · {formatMoney(p.priceCents)}
                  {onOrder > 0 ? ` (${onOrder} on order)` : ''}
                </Button>
              );
            })}
          </div>
        )}
      </section>

      {/* Clay */}
      {(clayByWeight.length > 0 || clayEach.length > 0) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Clay</h3>
          {clayByWeight.map((p) => (
            <WeightAdd key={p.id} product={p} disabled={busy || !order} onAdd={onAddByWeight} />
          ))}
          {clayEach.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {clayEach.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || !order}
                  onClick={() => onAddProduct(p)}
                >
                  {p.name} · {formatMoney(p.priceCents)}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** A by-the-pound product: type the weight, see the price, add it as one line. */
export function WeightAdd({
  product,
  disabled,
  onAdd,
}: {
  product: ProductCatalogItem;
  disabled: boolean;
  onAdd: (productId: string, weightLb: number) => Promise<boolean>;
}) {
  const [weight, setWeight] = useState('');
  const weightLb = parseWeight(weight);
  const priced = weightLb !== null ? priceByWeight(weightLb, product.priceCents, product.minChargeCents) : null;

  async function submit() {
    if (weightLb === null || !priced?.ok) return;
    if (await onAdd(product.id, weightLb)) setWeight('');
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 xl:gap-3">
      <div className="min-w-0 flex-1 basis-24">
        <p className="font-medium leading-tight">{product.name}</p>
        <p className="text-sm text-muted-foreground">{formatMoney(product.priceCents)} per lb</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          placeholder="0.0"
          value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          aria-label={`${product.name} weight in pounds`}
          className="min-h-11 w-24 text-base"
        />
        <span className="text-sm text-muted-foreground">lb</span>
      </div>
      <span className="w-16 text-right text-lg font-semibold">
        {priced?.ok ? formatMoney(priced.cents) : '—'}
      </span>
      <Button className="min-h-11" disabled={disabled || !priced?.ok} onClick={() => void submit()}>
        Add
      </Button>
      {priced && !priced.ok && <p className="basis-full text-sm text-amber-900">{priced.reason}</p>}
    </div>
  );
}

/**
 * Weigh pieces one at a time. Prices shown here come from the same pure
 * function the server uses (quoteMemberFiring) with the catalog's rates; the
 * server prices the lines again when they're added.
 */
function FiringCalculator({
  rates,
  disabledReason,
  busy,
  onSubmit,
}: {
  rates: FiringRates;
  disabledReason: string | null;
  busy: boolean;
  onSubmit: (pieces: FiringPieceInput[]) => Promise<boolean>;
}) {
  const [pieces, setPieces] = useState<FiringPieceInput[]>([]);
  const [weight, setWeight] = useState('');
  const [oversize, setOversize] = useState(false);

  const disabled = disabledReason !== null;
  const weightLb = parseWeight(weight);
  const draftQuote = weightLb !== null ? quoteMemberFiring([{ weightLb, oversize }], rates) : null;
  const quote = useMemo(() => quoteMemberFiring(pieces, rates), [pieces, rates]);

  function addPiece() {
    if (weightLb === null || !draftQuote?.ok) return;
    setPieces((prev) => [...prev, { weightLb, oversize }]);
    setWeight('');
    setOversize(false);
  }

  async function submit() {
    if (pieces.length === 0 || !quote.ok) return;
    if (await onSubmit(pieces)) setPieces([]);
  }

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border p-3', disabled && 'bg-muted/40')}>
      <p className="text-sm text-muted-foreground">
        {formatMoney(rates.standardCentsPerLb)} per lb · over 12 in {formatMoney(rates.oversizeCentsPerLb)} per lb
        {rates.minChargeCents > 0 ? ` · ${formatMoney(rates.minChargeCents)} minimum per piece` : ''}
      </p>

      {disabled ? (
        <p className="text-sm font-medium text-amber-900">{disabledReason}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                inputMode="decimal"
                placeholder="0.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPiece();
                }}
                aria-label="Piece weight in pounds"
                className="min-h-11 w-24 text-base"
              />
              <span className="text-sm text-muted-foreground">lb</span>
            </div>
            <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <Switch checked={oversize} onCheckedChange={setOversize} />
              Over 12 in
            </Label>
            <span className="ml-auto text-right">
              <span className="text-lg font-semibold">
                {draftQuote?.ok ? formatMoney(draftQuote.totalCents) : '—'}
              </span>
              {draftQuote?.ok && draftQuote.lines[0].minimumApplied && (
                <span className="block text-xs text-muted-foreground">minimum applied</span>
              )}
            </span>
            <Button variant="outline" className="min-h-11" disabled={!draftQuote?.ok} onClick={addPiece}>
              Add piece
            </Button>
          </div>
          {draftQuote && !draftQuote.ok && <p className="text-sm text-amber-900">{draftQuote.reason}</p>}

          {pieces.length > 0 && quote.ok && (
            <>
              <div className="divide-y rounded-md border bg-background">
                {quote.lines.map((line) => (
                  <div key={line.index} className="flex min-h-11 items-center gap-3 px-3 text-sm">
                    <span className="flex-1">
                      Piece {line.index + 1}: {line.weightLb.toFixed(1)} lb
                      {line.oversize ? ', over 12 in' : ''}
                      {line.minimumApplied && (
                        <span className="text-muted-foreground"> · minimum applied</span>
                      )}
                    </span>
                    <span className="font-medium">{formatMoney(line.chargeCents)}</span>
                    <button
                      type="button"
                      aria-label={`Remove piece ${line.index + 1}`}
                      onClick={() => setPieces((prev) => prev.filter((_, i) => i !== line.index))}
                      className="flex size-11 items-center justify-center text-lg text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button className="min-h-11" disabled={busy} onClick={() => void submit()}>
                Add {pieces.length} piece{pieces.length === 1 ? '' : 's'} to order · {formatMoney(quote.totalCents)}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
