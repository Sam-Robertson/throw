'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomAmountDialog } from './cart/CustomAmountDialog';
import { CustomerPanel } from './cart/CustomerPanel';
import { DiscountDialog } from './cart/DiscountDialog';
import { describeDiscount } from './cart/discountLabels';
import { LineItemRow } from './cart/LineItemRow';
import { OrderSummary } from './cart/OrderSummary';
import { ReaderStatusBar } from './cart/ReaderStatusBar';
import { useReaderStatus } from './payment/useReaderStatus';
import {
  apiErrorMessage,
  formatMoney,
  orderHasDropIn,
  remainingBalanceCents,
  type ApiErrorBody,
  type PosCatalog,
  type PosOrder,
  type PosOrderDiscount,
} from './types';

interface CartPanelProps {
  order: PosOrder | null;
  busy: boolean;
  onUpdateItemQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSetItemDiscount: (itemId: string, discountCents: number) => void;
  onAttachCustomer: (customerId: string | null) => void;
  onSetTip: (tipCents: number) => void;
  onVoid: (reason: string) => void;
  onCharge: () => void;
  /** Short studio label shown beside Charge, so a sale never lands at the wrong studio. */
  /** For the saved staff discounts and the group events they can be tied to. */
  catalog?: PosCatalog | null;
  /** Called with the order returned by any route this panel calls itself. */
  onOrderUpdate?: (order: PosOrder) => void;
  /** Sets the order aside for a customer who stepped away. Hidden when not given. */
  onPark?: () => void;
}

const TIP_PRESETS = [100, 200, 500];
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const NOTICE_MS = 8000;

type Notice = { kind: 'info' | 'warn' | 'error'; text: string };

const NOTICE_STYLES: Record<Notice['kind'], string> = {
  info: 'border-green-300 bg-green-50 text-green-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

/** Why the order can't be charged yet, in words; null when it can. */
function chargeBlockReason(order: PosOrder | null): string | null {
  if (!order) return 'Starting an order…';
  if (order.status === 'COMPLETED') return 'This order is paid';
  if (order.status !== 'OPEN') return 'This order is closed';
  if (order.items.length === 0) return 'Add an item to charge';
  if (!order.customerId) {
    // Drop-ins book a seat and class packs put credits on an account; the
    // server refuses payment without a customer (CUSTOMER_REQUIRED).
    if (orderHasDropIn(order)) return 'Attach a customer to sell a class';
    if (order.items.some((i) => i.category === 'CLASS_PACK')) return 'Attach a customer to sell a class pack';
  }
  return null;
}

export function CartPanel({
  order: orderProp,
  busy: busyProp,
  onUpdateItemQuantity,
  onRemoveItem,
  onSetItemDiscount,
  onAttachCustomer,
  onSetTip,
  onVoid,
  onCharge,
  catalog = null,
  onOrderUpdate,
  onPark,
}: CartPanelProps) {
  // Without onOrderUpdate the parent can't take the orders this panel fetches,
  // so hold the latest one here until the parent's copy catches up.
  const [override, setOverride] = useState<PosOrder | null>(null);
  const order =
    override && orderProp && override.id === orderProp.id && override.updatedAt >= orderProp.updatedAt
      ? override
      : orderProp;

  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [taxWarning, setTaxWarning] = useState<string | null>(null);

  const [tipPanelOpen, setTipPanelOpen] = useState(false);
  const [customTip, setCustomTip] = useState('');
  const [discountOpen, setDiscountOpen] = useState(false);
  const [customAmountOpen, setCustomAmountOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const reader = useReaderStatus(order?.locationId);

  const orderId = order?.id ?? null;
  const open = order?.status === 'OPEN';
  const busy = busyProp || working || !open;

  function applyOrder(updated: PosOrder) {
    if (onOrderUpdate) onOrderUpdate(updated);
    else setOverride(updated);
  }

  useEffect(() => {
    setNotice(null);
    setTaxWarning(null);
    setTipPanelOpen(false);
  }, [orderId]);

  // Only item and customer changes recalculate tax, so keep the last warning
  // until a response carries the field again.
  useEffect(() => {
    if (order && 'taxWarning' in order) setTaxWarning(order.taxWarning ?? null);
  }, [order]);

  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // Say so when a member discount arrives with the customer, so staff can
  // explain the price change. Keyed by discount code: the rows themselves may
  // be rebuilt on every reprice.
  const seenAutomatic = useRef<{ orderId: string | null; keys: Set<string> }>({ orderId: null, keys: new Set() });
  useEffect(() => {
    if (!order) return;
    const automatic = order.discounts.filter((d) => d.automatic);
    const keys = new Set(automatic.map((d) => d.discountCodeId ?? d.name));
    const seen = seenAutomatic.current;
    if (seen.orderId === order.id) {
      const fresh = automatic.filter((d) => !seen.keys.has(d.discountCodeId ?? d.name));
      if (fresh.length > 0) {
        setNotice({
          kind: 'info',
          text: fresh
            .map(
              (d) =>
                `${d.name} applied${d.discountCode ? ` · ${describeDiscount(d.discountCode)}` : ''}. It comes with their membership.`,
            )
            .join(' '),
        });
      }
    }
    seenAutomatic.current = { orderId: order.id, keys };
  }, [order]);

  /** Calls an order route that answers with the order; shows `message ?? error` when it doesn't. */
  async function callOrderRoute(path: string, init: RequestInit, fallback: string): Promise<PosOrder | null> {
    setWorking(true);
    const res = await fetch(path, init).catch(() => null);
    setWorking(false);
    if (!res) {
      setNotice({ kind: 'error', text: 'Could not reach the server. Check the connection and try again.' });
      return null;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setNotice({ kind: 'error', text: apiErrorMessage(data, fallback) });
      return null;
    }
    const updated = (await res.json()) as PosOrder;
    applyOrder(updated);
    return updated;
  }

  async function setItemNote(itemId: string, note: string | null) {
    if (!order) return;
    setNotice(null);
    await callOrderRoute(
      `/api/pos/orders/${order.id}/items/${itemId}`,
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ note }) },
      'Could not save the note',
    );
  }

  async function removeDiscount(discount: PosOrderDiscount) {
    if (!order) return;
    setNotice(null);
    await callOrderRoute(
      `/api/pos/orders/${order.id}/discounts/${discount.id}`,
      { method: 'DELETE' },
      'Could not remove the discount',
    );
  }

  function submitCustomTip() {
    const dollars = parseFloat(customTip);
    if (Number.isFinite(dollars) && dollars >= 0) {
      onSetTip(Math.round(dollars * 100));
      setCustomTip('');
      setTipPanelOpen(false);
    }
  }

  function submitVoid() {
    if (!voidReason.trim()) return;
    onVoid(voidReason.trim());
    setVoidOpen(false);
    setVoidReason('');
  }

  const items = order?.items ?? [];
  const blockReason = chargeBlockReason(order);
  const remaining = order ? remainingBalanceCents(order) : 0;
  const paidCents = order ? order.totalCents - remaining : 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CustomerPanel
        order={order}
        catalog={catalog}
        busy={busy}
        onAttachCustomer={onAttachCustomer}
        onOrderUpdate={applyOrder}
      />

      {/* Line items */}
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border bg-card">
        {!order?.customerId && items.length > 0 && (
          <p className="border-b px-3 py-1.5 text-sm">
            <span className="font-semibold">Walk-in</span>
            {order?.walkInName ? <span className="text-muted-foreground"> · {order.walkInName}</span> : null}
          </p>
        )}
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No items in this order yet.</p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                busy={busy}
                onUpdateQuantity={onUpdateItemQuantity}
                onRemove={onRemoveItem}
                onSetDiscount={onSetItemDiscount}
                onSetNote={setItemNote}
              />
            ))}
          </div>
        )}
      </div>

      <OrderSummary order={order} busy={busy} taxWarning={taxWarning} onRemoveDiscount={removeDiscount} />

      {/* Actions */}
      <div className="space-y-2">
        {notice && (
          <div
            className={`flex items-start justify-between gap-2 rounded-md border p-3 text-sm ${NOTICE_STYLES[notice.kind]}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="-m-2 min-h-11 min-w-11 shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {tipPanelOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
            {TIP_PRESETS.map((cents) => (
              <Button
                key={cents}
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  onSetTip(cents);
                  setTipPanelOpen(false);
                }}
              >
                {formatMoney(cents)}
              </Button>
            ))}
            <div className="flex min-w-40 flex-1 items-center gap-1.5">
              <Input
                inputMode="decimal"
                placeholder="Custom $"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                className="min-h-11 text-base"
              />
              <Button className="min-h-11" onClick={submitCustomTip}>
                Set
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="min-h-11 whitespace-normal px-2"
            onClick={() => setTipPanelOpen((v) => !v)}
            disabled={busy || !order}
            title="Backup: customers are asked for a tip at checkout (on the reader, or on screen for other tenders)"
          >
            {order && order.tipCents > 0 ? 'Change tip' : 'Add tip'}
          </Button>
          <Button
            variant="outline"
            className="min-h-11 whitespace-normal px-2"
            onClick={() => setDiscountOpen(true)}
            disabled={busy || !order}
          >
            Discount
          </Button>
          <Button
            variant="outline"
            className="min-h-11 whitespace-normal px-2 leading-tight"
            onClick={() => setCustomAmountOpen(true)}
            disabled={busy || !order}
          >
            Custom amount
          </Button>
        </div>

        <div className="flex gap-2">
          {onPark && (
            <Button
              variant="outline"
              className="min-h-11 flex-1"
              onClick={onPark}
              disabled={busy || !order || items.length === 0}
            >
              Park order
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-11 flex-1 text-destructive"
            onClick={() => setVoidOpen(true)}
            disabled={busy || !order}
          >
            Void order
          </Button>
        </div>
      </div>

      {/* Reader status and Charge stay in view however long the order gets. */}
      <div className="sticky bottom-0 z-10 -mx-1 space-y-2 bg-background px-1 pb-1 pt-2">
        <ReaderStatusBar status={reader} />

        {paidCents > 0 && open && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Paid so far {formatMoney(paidCents)} · <span className="font-semibold">Remaining {formatMoney(remaining)}</span>
          </p>
        )}

        <div className="flex items-stretch gap-2">
          <Button
            className="h-auto min-h-14 flex-1 whitespace-normal text-lg font-semibold leading-tight"
            onClick={onCharge}
            disabled={busyProp || working || blockReason !== null}
          >
            {blockReason ??
              (remaining === 0
                ? 'Complete order · nothing to pay'
                : `Charge ${formatMoney(remaining)}`)}
          </Button>
        </div>
      </div>

      {order && (
        <>
          <DiscountDialog
            open={discountOpen}
            onOpenChange={setDiscountOpen}
            order={order}
            catalog={catalog}
            onApplied={(updated, discountWarning) => {
              applyOrder(updated);
              setNotice(
                discountWarning
                  ? { kind: 'warn', text: `${discountWarning} It takes effect when a qualifying item is added.` }
                  : { kind: 'info', text: 'Discount applied.' },
              );
            }}
          />
          <CustomAmountDialog
            open={customAmountOpen}
            onOpenChange={setCustomAmountOpen}
            orderId={order.id}
            onAdded={applyOrder}
          />
        </>
      )}

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone from this screen. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Reason for voiding"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="min-h-11 text-base"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={submitVoid}
              disabled={!voidReason.trim()}
            >
              Void order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
