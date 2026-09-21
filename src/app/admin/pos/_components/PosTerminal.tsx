'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shortLocationName } from '@/lib/locationName';
import type { FiringPieceInput } from '@/lib/firing';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CatalogPanel } from './CatalogPanel';
import { CartPanel } from './CartPanel';
import { PaymentSheet } from './PaymentSheet';
import {
  apiErrorMessage,
  formatMoney,
  isQuantityLocked,
  type ApiErrorBody,
  type CourseCatalogItem,
  type CustomerSummary,
  type Location,
  type PosCatalog,
  type PosOrder,
  type ProductCatalogItem,
} from './types';

/** A row of GET /api/pos/orders?resumable=1. */
interface ResumableOrder {
  id: string;
  orderNumber: number;
  totalCents: number;
  createdAt: string;
  parkedAt: string | null;
  walkInName: string | null;
  customerName: string | null;
  itemQuantity: number;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The studio this device last rang sales at. */
const LOCATION_STORAGE_KEY = 'throw.pos.locationId';

function rememberedLocationId(): string | null {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {
    return null; // private mode, storage blocked
  }
}

function rememberLocationId(id: string) {
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, id);
  } catch {
    // Not remembered; the first studio is used next time.
  }
}

export function PosTerminal({
  staffName,
  isAdmin,
  locations,
}: {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
  /** Active studios this person may ring sales at (page.tsx scopes staff to theirs). */
  locations: Location[];
}) {
  // The register is always bound to exactly one studio: it decides the readers,
  // prices, sessions, tax and where the sale is reported. Never "All".
  const [locationId, setLocationId] = useState('');
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Set when Stripe Tax fell back to zero tax. Only item changes recalculate
  // tax, so it's updated from responses that carry the field and kept otherwise.
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const [resumeListOpen, setResumeListOpen] = useState(false);
  const [resumableOrders, setResumableOrders] = useState<ResumableOrder[]>([]);

  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null);
  const [customerSummaryError, setCustomerSummaryError] = useState<string | null>(null);

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const busy = pending > 0;
  const location = locations.find((l) => l.id === locationId) ?? null;
  const locationName = location ? shortLocationName(location.name, location.address) : '';

  // Order changes run one at a time, each against the order the last one left
  // behind, so quick taps on a piece button queue up instead of being dropped.
  const orderRef = useRef<PosOrder | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const applyOrder = useCallback((next: PosOrder | null) => {
    orderRef.current = next;
    setOrder(next);
  }, []);

  function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    setPending((n) => n + 1);
    const result = queueRef.current.then(async () => {
      try {
        return await task();
      } catch {
        setError('Something went wrong. Check the connection and try again.');
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    });
    queueRef.current = result;
    return result;
  }

  // Last studio used on this device if it's still one of theirs, else the first.
  useEffect(() => {
    const remembered = rememberedLocationId();
    const initial = locations.find((l) => l.id === remembered) ?? locations[0];
    if (initial) setLocationId(initial.id);
  }, [locations]);

  // Whenever the studio changes, start a fresh OPEN order there and load its catalog.
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setPending((n) => n + 1);
    setCatalog(null);
    Promise.all([
      fetch('/api/pos/orders', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ locationId }),
      }),
      fetch(`/api/pos/catalog?locationId=${locationId}`),
    ])
      .then(async ([orderRes, catalogRes]) => {
        if (cancelled) return;
        if (!orderRes.ok || !catalogRes.ok) {
          const data = (await (orderRes.ok ? catalogRes : orderRes).json().catch(() => ({}))) as ApiErrorBody;
          setError(apiErrorMessage(data, "Couldn't start an order at this studio"));
          return;
        }
        applyOrder((await orderRes.json()) as PosOrder);
        setCatalog((await catalogRes.json()) as PosCatalog);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the server. Check the connection and reload.");
      })
      .finally(() => setPending((n) => n - 1));
    return () => {
      cancelled = true;
    };
  }, [locationId, applyOrder]);

  // Who the customer is drives member firing, the Memberships tab and the
  // "booked today" banner. Reloaded when the order completes (tickets, credit).
  const customerId = order?.customerId ?? null;
  const orderStatus = order?.status ?? null;
  useEffect(() => {
    setCustomerSummary(null);
    setCustomerSummaryError(null);
    if (!customerId || !locationId) return;
    let cancelled = false;
    fetch(`/api/pos/customers/${customerId}/summary?locationId=${locationId}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) setCustomerSummary((await r.json()) as CustomerSummary);
        else setCustomerSummaryError("Couldn't load this customer's details.");
      })
      .catch(() => {
        if (!cancelled) setCustomerSummaryError("Couldn't load this customer's details.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, locationId, orderStatus]);

  // Parked orders (anyone's) and this person's other open orders at this
  // studio. Refreshed whenever the current order changes, for the count badge.
  const orderId = order?.id ?? null;
  const loadResumable = useCallback(async () => {
    if (!locationId) return;
    const params = new URLSearchParams({ resumable: '1', locationId, limit: '20' });
    if (orderId) params.set('excludeId', orderId);
    const res = await fetch(`/api/pos/orders?${params.toString()}`).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { orders: ResumableOrder[] };
      setResumableOrders(data.orders ?? []);
    }
  }, [locationId, orderId]);

  useEffect(() => {
    void loadResumable();
  }, [loadResumable]);

  const refreshOrderState = useCallback(
    async (res: Response): Promise<boolean> => {
      if (res.ok) {
        const data = (await res.json()) as PosOrder;
        applyOrder(data);
        setError(null);
        return true;
      }
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, 'Something went wrong'));
      return false;
    },
    [applyOrder],
  );

  /** One queued change to the current order; resolves true when the server took it. */
  async function mutateOrder(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    const ok = await run(async () => {
      const current = orderRef.current;
      if (!current) return false;
      const res = await fetch(`/api/pos/orders/${current.id}${path}`, {
        method,
        ...(body !== undefined ? { headers: JSON_HEADERS, body: JSON.stringify(body) } : {}),
      });
      return refreshOrderState(res);
    });
    return ok === true;
  }

  async function reloadCatalog() {
    if (!locationId) return;
    const res = await fetch(`/api/pos/catalog?locationId=${locationId}`);
    if (res.ok) setCatalog((await res.json()) as PosCatalog);
  }

  // One tap adds one. A product already on the order has its quantity raised
  // instead; the line is looked up when the tap's turn comes, not when it was made.
  function addProduct(product: ProductCatalogItem) {
    void run(async () => {
      const current = orderRef.current;
      if (!current) return;
      const existing = current.items.find(
        (i) => i.itemType === 'RETAIL' && i.refId === product.id && !isQuantityLocked(i),
      );
      const res = existing
        ? await fetch(`/api/pos/orders/${current.id}/items/${existing.id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ quantity: existing.quantity + 1 }),
          })
        : await fetch(`/api/pos/orders/${current.id}/items`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ itemType: 'RETAIL', refId: product.id, quantity: 1 }),
          });
      await refreshOrderState(res);
    });
  }

  // Clay and extra clay: the server prices the line from the weight.
  function addByWeight(productId: string, weightLb: number) {
    return mutateOrder('/items', 'POST', { itemType: 'RETAIL', refId: productId, weightLb });
  }

  // Member firing: one line per piece, priced by the server (src/lib/firing.ts).
  function addFiring(pieces: FiringPieceInput[]) {
    return mutateOrder('/firing', 'POST', { pieces });
  }

  // Each class is its own line: one seat in one session for the order's customer.
  function addDropIn(studioSessionId: string) {
    void mutateOrder('/items', 'POST', { itemType: 'DROP_IN', metadata: { studioSessionId } });
  }

  // A course is one line at the course price; the server books every remaining session.
  function addCourse(course: CourseCatalogItem) {
    void mutateOrder('/items', 'POST', {
      itemType: 'DROP_IN',
      metadata: { studioSessionId: course.sessionId, ...(course.seriesId ? { seriesId: course.seriesId } : {}) },
    });
  }

  function addDistinct(payload: {
    itemType: 'GIFT_CARD' | 'CUSTOM';
    name?: string;
    unitPriceCents: number;
    metadata?: Record<string, unknown>;
  }) {
    void mutateOrder('/items', 'POST', payload);
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    void mutateOrder(`/items/${itemId}`, 'PATCH', { quantity });
  }

  function setItemDiscount(itemId: string, discountCents: number) {
    void mutateOrder(`/items/${itemId}`, 'PATCH', { discountCents });
  }

  function removeItem(itemId: string) {
    void mutateOrder(`/items/${itemId}`, 'DELETE');
  }

  function attachCustomer(customerId: string | null) {
    void mutateOrder('', 'PATCH', { customerId });
  }

  function setTip(tipCents: number) {
    void mutateOrder('', 'PATCH', { tipCents });
  }

  // Always at the bound studio.
  async function startNewOrder() {
    if (!locationId) return;
    const res = await fetch('/api/pos/orders', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ locationId }),
    });
    if (res.ok) {
      applyOrder((await res.json()) as PosOrder);
    }
    // Seat counts changed if the last order booked a class.
    void reloadCatalog();
  }

  /** Parks the current order if there's anything on it. False when the server refused. */
  async function parkCurrentOrder(): Promise<boolean> {
    const current = orderRef.current;
    if (!current || current.status !== 'OPEN' || current.items.length === 0) return true;
    const res = await fetch(`/api/pos/orders/${current.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ parked: true }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(apiErrorMessage(data, "Couldn't park this order"));
    }
    return res.ok;
  }

  // The customer stepped away: keep their order for later and serve the next person.
  function parkOrder() {
    void run(async () => {
      if (!(await parkCurrentOrder())) return;
      setError(null);
      await startNewOrder();
    });
  }

  function resumeOrder(id: string) {
    void run(async () => {
      // Whatever is on the register now is parked, not lost.
      if (!(await parkCurrentOrder())) return;
      const res = await fetch(`/api/pos/orders/${id}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ parked: false }),
      });
      if (await refreshOrderState(res)) {
        setResumeListOpen(false);
      } else {
        void loadResumable(); // someone else finished or voided it
      }
    });
  }

  // Items never move between studios: tax, prices and class seats belong to the
  // studio they were rung up at. An order with items stays behind, parked.
  function changeLocation(nextId: string) {
    if (nextId === locationId) return;
    void run(async () => {
      const current = orderRef.current;
      const leavingItems =
        current && current.status === 'OPEN' ? current.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
      if (!(await parkCurrentOrder())) return;
      const next = locations.find((l) => l.id === nextId);
      setLocationNotice(
        current && leavingItems > 0 && next
          ? `Order #${current.orderNumber} and its ${leavingItems === 1 ? 'item' : `${leavingItems} items`} stayed at ${locationName}, parked. Switch back to ${locationName} to resume it. This is a new order at ${shortLocationName(next.name, next.address)}.`
          : null,
      );
      rememberLocationId(nextId);
      setResumeListOpen(false);
      setResumableOrders([]);
      applyOrder(null);
      setLocationId(nextId);
    });
  }

  function voidOrder(reason: string) {
    void run(async () => {
      const current = orderRef.current;
      if (!current) return;
      const res = await fetch(`/api/pos/orders/${current.id}/void`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await startNewOrder();
        setError(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
        setError(apiErrorMessage(data, 'Failed to void order'));
      }
    });
  }

  // A void always carries a reason (the server refuses one without). The order
  // panel asks for it; if it's ever called without one, ask here.
  function requestVoid(reason?: string) {
    const given = typeof reason === 'string' ? reason.trim() : '';
    if (given) {
      voidOrder(given);
    } else {
      setVoidReason('');
      setVoidDialogOpen(true);
    }
  }

  function confirmVoid() {
    if (!voidReason.trim()) return;
    voidOrder(voidReason.trim());
    setVoidDialogOpen(false);
  }

  function openPaymentSheet() {
    if (!order) return;
    setPaymentSheetOpen(true);
  }

  function toggleResumeList() {
    const opening = !resumeListOpen;
    setResumeListOpen(opening);
    if (opening) void loadResumable();
  }

  const itemCount = order?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const canPark = !!order && order.status === 'OPEN' && order.items.length > 0;

  const cartProps = {
    order,
    busy,
    locationName,
    catalog,
    onUpdateItemQuantity: updateItemQuantity,
    onRemoveItem: removeItem,
    onSetItemDiscount: setItemDiscount,
    onAttachCustomer: attachCustomer,
    onSetTip: setTip,
    onOrderUpdate: applyOrder,
    onVoid: requestVoid,
    onCharge: openPaymentSheet,
  };

  if (locations.length === 0) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">
          You aren&apos;t assigned to an active studio, so there is nowhere to ring up a sale. Ask an
          admin to add you to a studio.
        </p>
      </main>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 lg:pb-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">
            {staffName}
            {order && <span> · Order #{order.orderNumber}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {locations.length > 1 ? (
            <select
              value={locationId}
              onChange={(e) => changeLocation(e.target.value)}
              disabled={busy}
              aria-label="Studio"
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm font-medium"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{shortLocationName(l.name, l.address)}</option>
              ))}
            </select>
          ) : (
            <span className="px-1 text-sm font-medium">{locationName}</span>
          )}

          <Button variant="outline" className="min-h-11" disabled={!canPark || busy} onClick={parkOrder}>
            Park order
          </Button>

          <div className="relative">
            <Button variant="outline" className="min-h-11 gap-2" onClick={toggleResumeList}>
              Resume open order
              {resumableOrders.length > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
                  {resumableOrders.length}
                </span>
              )}
            </Button>
            {resumeListOpen && (
              <div className="absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-card p-2 shadow-lg">
                {resumableOrders.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No parked or open orders at {locationName}.
                  </p>
                ) : (
                  <div className="max-h-96 divide-y overflow-y-auto">
                    {resumableOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={busy}
                        onClick={() => resumeOrder(o.id)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {o.customerName ?? o.walkInName ?? 'Walk-in'}
                          </span>
                          <span className="block text-muted-foreground">
                            {o.parkedAt ? 'Parked' : 'Open'} · #{o.orderNumber} · {o.itemQuantity} item
                            {o.itemQuantity === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium">{formatMoney(o.totalCents)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="outline" className="min-h-11" asChild>
            <NextLink href="/admin/pos/orders">Order History</NextLink>
          </Button>
        </div>
      </div>

      {locationNotice && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950">
          <span>{locationNotice}</span>
          <button
            type="button"
            onClick={() => setLocationNotice(null)}
            className="-my-2 flex min-h-11 shrink-0 items-center px-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Two column on lg+, stacked below. On an iPad in landscape the admin
          sidebar leaves about 780px, so the order panel gets a bigger share
          there than on a laptop. */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 lg:w-[58%] xl:w-2/3">
          <CatalogPanel
            catalog={catalog}
            order={order}
            busy={busy}
            customerSummary={customerSummary}
            customerSummaryLoading={!!customerId && !customerSummary && !customerSummaryError}
            customerSummaryError={customerSummaryError}
            onAddProduct={addProduct}
            onAddByWeight={addByWeight}
            onAddFiring={addFiring}
            onAddDropIn={addDropIn}
            onAddCourse={addCourse}
            onAddDistinct={addDistinct}
          />
        </div>
        <div className="hidden min-w-0 lg:block lg:w-[42%] xl:w-1/3">
          <CartPanel {...cartProps} />
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 lg:hidden">
        <Button
          className="min-h-14 w-full justify-between text-base"
          onClick={() => setMobileCartOpen(true)}
        >
          <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span>{formatMoney(order?.totalCents ?? 0)}</span>
        </Button>
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Cart</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CartPanel {...cartProps} />
          </div>
        </SheetContent>
      </Sheet>

      <PaymentSheet
        order={order}
        isAdmin={isAdmin}
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        onOrderUpdate={applyOrder}
        onNewOrder={startNewOrder}
      />

      {/* Void: confirmation and a reason, every time */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void order #{order?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the whole order and can&apos;t be undone. Say why, so it makes sense in the
              order history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmVoid();
            }}
            placeholder="Reason (customer changed their mind, rang up by mistake…)"
            maxLength={500}
            className="min-h-11 text-base"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep order</AlertDialogCancel>
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={!voidReason.trim()}
              onClick={confirmVoid}
            >
              Void order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
