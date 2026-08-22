'use client';

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CatalogPanel } from './CatalogPanel';
import { CartPanel } from './CartPanel';
import { PaymentSheet } from './PaymentSheet';
import { formatMoney, type Location, type PosCatalog, type PosOrder } from './types';

interface ResumableOrder {
  id: string;
  orderNumber: number;
  totalCents: number;
  createdAt: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function PosTerminal({
  staffId,
  staffName,
  isAdmin,
}: {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const [resumeListOpen, setResumeListOpen] = useState(false);
  const [resumableOrders, setResumableOrders] = useState<ResumableOrder[]>([]);

  // Load locations, default to the first active one.
  useEffect(() => {
    fetch('/api/admin/locations')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Location[]) => {
        setLocations(data);
        const first = data.find((l) => l.isActive) ?? data[0];
        if (first) setLocationId(first.id);
      });
  }, []);

  // Whenever the working location changes, start a fresh OPEN order and load its catalog.
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setBusy(true);
    Promise.all([
      fetch('/api/pos/orders', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ locationId }),
      }).then((r) => r.json()),
      fetch(`/api/pos/catalog?locationId=${locationId}`).then((r) => r.json()),
    ]).then(([newOrder, catalogData]) => {
      if (cancelled) return;
      setOrder(newOrder);
      setCatalog(catalogData);
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const refreshOrderState = useCallback(async (res: Response) => {
    if (res.ok) {
      setOrder(await res.json());
      setError(null);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Something went wrong');
    }
  }, []);

  async function addItem(payload: Record<string, unknown>) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}/items`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    await refreshOrderState(res);
    setBusy(false);
  }

  function addOrIncrement(
    itemType: 'RETAIL' | 'DROP_IN' | 'MEMBERSHIP',
    refId: string,
    metadata?: Record<string, unknown>,
  ) {
    if (!order) return;
    const metaKey = JSON.stringify(metadata ?? null);
    const existing = order.items.find(
      (i) => i.itemType === itemType && i.refId === refId && JSON.stringify(i.metadata ?? null) === metaKey,
    );
    if (existing) {
      void updateItemQuantity(existing.id, existing.quantity + 1);
    } else {
      void addItem({ itemType, refId, quantity: 1, metadata });
    }
  }

  function addDistinct(payload: {
    itemType: 'GIFT_CARD' | 'CUSTOM';
    name?: string;
    unitPriceCents: number;
    metadata?: Record<string, unknown>;
  }) {
    void addItem(payload);
  }

  async function updateItemQuantity(itemId: string, quantity: number) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}/items/${itemId}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ quantity }),
    });
    await refreshOrderState(res);
    setBusy(false);
  }

  async function setItemDiscount(itemId: string, discountCents: number) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}/items/${itemId}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ discountCents }),
    });
    await refreshOrderState(res);
    setBusy(false);
  }

  async function removeItem(itemId: string) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}/items/${itemId}`, { method: 'DELETE' });
    await refreshOrderState(res);
    setBusy(false);
  }

  async function attachCustomer(customerId: string | null) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ customerId }),
    });
    await refreshOrderState(res);
    setBusy(false);
  }

  async function setTip(tipCents: number) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ tipCents }),
    });
    await refreshOrderState(res);
    setBusy(false);
  }

  async function startNewOrder() {
    if (!locationId) return;
    const res = await fetch('/api/pos/orders', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ locationId }),
    });
    if (res.ok) setOrder(await res.json());
  }

  async function voidOrder(reason: string) {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/pos/orders/${order.id}/void`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      await startNewOrder();
      setError(null);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to void order');
    }
    setBusy(false);
  }

  function openPaymentSheet() {
    if (!order) return;
    setPaymentSheetOpen(true);
  }

  async function toggleResumeList() {
    const opening = !resumeListOpen;
    setResumeListOpen(opening);
    if (opening && locationId) {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const params = new URLSearchParams({
        status: 'OPEN',
        staffId,
        locationId,
        from: twelveHoursAgo,
        limit: '20',
      });
      const res = await fetch(`/api/pos/orders?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { orders: ResumableOrder[] };
        setResumableOrders(data.orders ?? []);
      }
    }
  }

  async function resumeOrder(id: string) {
    const res = await fetch(`/api/pos/orders/${id}`);
    if (res.ok) {
      setOrder(await res.json());
      setResumeListOpen(false);
    }
  }

  const itemCount = order?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  const cartProps = {
    order,
    busy,
    onUpdateItemQuantity: updateItemQuantity,
    onRemoveItem: removeItem,
    onSetItemDiscount: setItemDiscount,
    onAttachCustomer: attachCustomer,
    onSetTip: setTip,
    onVoid: voidOrder,
    onCharge: openPaymentSheet,
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 lg:pb-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">{staffName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order && (
            <span className="min-h-11 rounded-md border bg-card px-3 py-2 text-sm font-medium">
              Order #{order.orderNumber}
            </span>
          )}

          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}

          <div className="relative">
            <Button variant="outline" className="min-h-11" onClick={toggleResumeList}>
              Resume open order
            </Button>
            {resumeListOpen && (
              <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border bg-card p-2 shadow-lg">
                {resumableOrders.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No other open orders in the last 12 hours.
                  </p>
                ) : (
                  <div className="divide-y">
                    {resumableOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => resumeOrder(o.id)}
                        className="flex min-h-11 w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span>Order #{o.orderNumber}</span>
                        <span className="font-medium">{formatMoney(o.totalCents)}</span>
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

          <Button variant="outline" className="min-h-11" asChild>
            <NextLink href="/admin/pos/drawer">Cash Drawer</NextLink>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Two column on lg+, stacked below */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-2/3">
          <CatalogPanel
            catalog={catalog}
            order={order}
            busy={busy}
            locationId={locationId}
            onAddOrIncrement={addOrIncrement}
            onAddDistinct={addDistinct}
          />
        </div>
        <div className="hidden lg:block lg:w-1/3">
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
        onOrderUpdate={setOrder}
        onNewOrder={startNewOrder}
      />
    </div>
  );
}
