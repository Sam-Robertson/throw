'use client';

import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker, defaultRange, type DateRange } from '@/components/shared/DateRangePicker';
import { formatMountainTime } from '@/lib/timezone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { formatMoney, type PosOrder } from '../../_components/types';

interface StaffMember {
  id: string;
  name: string | null;
  email: string;
}

interface OrderListRow {
  id: string;
  orderNumber: number;
  customerId: string | null;
  staffId: string;
  status: string;
  totalCents: number;
  createdAt: string;
  completedAt: string | null;
  itemCount: number;
  paymentMethods: string[];
}

const STATUS_OPTIONS = ['OPEN', 'COMPLETED', 'VOIDED', 'REFUNDED'];

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  VOIDED: 'bg-red-100 text-red-800 border-red-200',
  REFUNDED: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function OrderHistoryClient({ isAdmin }: { isAdmin: boolean }) {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [status, setStatus] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [resendingReceipt, setResendingReceipt] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/staff')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StaffMember[]) => setStaffList(data));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      page: String(page),
      limit: '25',
    });
    if (status) params.set('status', status);
    if (staffId) params.set('staffId', staffId);

    const res = await fetch(`/api/pos/orders?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { orders: OrderListRow[]; totalPages: number };
      setOrders(data.orders);
      setTotalPages(data.totalPages);

      const idsToResolve = [
        ...new Set(data.orders.map((o) => o.customerId).filter((id): id is string => !!id)),
      ].filter((id) => !(id in customerNames));

      if (idsToResolve.length > 0) {
        const results = await Promise.all(
          idsToResolve.map((id) =>
            fetch(`/api/admin/customers/${id}`).then((r) => (r.ok ? r.json() : null)),
          ),
        );
        setCustomerNames((prev) => {
          const next = { ...prev };
          results.forEach((c: { id: string; name: string | null; email: string } | null, idx) => {
            if (c) next[idsToResolve[idx]] = c.name ?? c.email;
          });
          return next;
        });
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, status, staffId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function staffName(id: string) {
    const member = staffList.find((s) => s.id === id);
    return member?.name ?? member?.email ?? '—';
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/pos/orders/${id}`);
    if (res.ok) {
      setSelectedOrder((await res.json()) as PosOrder);
      setDetailOpen(true);
      setReceiptMessage(null);
    }
  }

  async function resendReceipt() {
    if (!selectedOrder) return;
    setResendingReceipt(true);
    const res = await fetch(`/api/pos/orders/${selectedOrder.id}/receipt`, { method: 'POST' });
    setReceiptMessage(res.ok ? 'Receipt sent.' : 'Failed to resend receipt.');
    setResendingReceipt(false);
  }

  function canVoid(order: PosOrder) {
    if (order.status === 'OPEN') return true;
    if (order.status !== 'COMPLETED' || !order.completedAt || !isAdmin) return false;
    return Date.now() - new Date(order.completedAt).getTime() <= 24 * 60 * 60 * 1000;
  }

  async function submitVoid() {
    if (!selectedOrder || !voidReason.trim()) return;
    const res = await fetch(`/api/pos/orders/${selectedOrder.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: voidReason.trim() }),
    });
    if (res.ok) {
      setSelectedOrder((await res.json()) as PosOrder);
      setVoidOpen(false);
      setVoidReason('');
      await load();
    }
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Order History</h1>
        <p className="text-sm text-muted-foreground">Point of sale transactions</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <DateRangePicker value={range} onChange={setRange} />

        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="block h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">Staff</label>
          <select
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setPage(1);
            }}
            className="block h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Order #</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No orders match.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => openDetail(o.id)}
                  >
                    <td className="px-4 py-2 font-medium">#{o.orderNumber}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatMountainTime(new Date(o.createdAt), 'datetime')}
                    </td>
                    <td className="px-4 py-2">
                      {o.customerId ? (customerNames[o.customerId] ?? '…') : 'Walk-in'}
                    </td>
                    <td className="px-4 py-2">{staffName(o.staffId)}</td>
                    <td className="px-4 py-2">{o.itemCount}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMoney(o.totalCents)}</td>
                    <td className="px-4 py-2">{o.paymentMethods.join(', ') || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge className={STATUS_BADGE[o.status] ?? ''}>{o.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                Prev
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Order #{selectedOrder.orderNumber}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="text-sm">
                  <p>
                    <span className="text-muted-foreground">Customer: </span>
                    {selectedOrder.customer?.name ?? selectedOrder.customer?.email ?? 'Walk-in'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Staff: </span>
                    {selectedOrder.staff?.name ?? selectedOrder.staff?.email}
                  </p>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Status: </span>
                    <Badge className={STATUS_BADGE[selectedOrder.status] ?? ''}>{selectedOrder.status}</Badge>
                  </p>
                  {selectedOrder.voidReason && (
                    <p className="mt-1 text-destructive">
                      <span className="text-muted-foreground">Void reason: </span>
                      {selectedOrder.voidReason}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Items</h3>
                  <div className="divide-y rounded-md border">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{item.quantity}× {item.name}</span>
                        <span className="font-medium">{formatMoney(item.totalCents)}</span>
                      </div>
                    ))}
                    {selectedOrder.items.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No items.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Payments</h3>
                  <div className="divide-y rounded-md border">
                    {selectedOrder.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{p.method}</span>
                        <span className="font-medium">{formatMoney(p.amountCents)}</span>
                      </div>
                    ))}
                    {selectedOrder.payments.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No payments recorded.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(selectedOrder.subtotalCents)}</span>
                  </div>
                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span>−{formatMoney(selectedOrder.discountCents)}</span>
                    </div>
                  )}
                  {selectedOrder.tipCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span>{formatMoney(selectedOrder.tipCents)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span>{formatMoney(selectedOrder.totalCents)}</span>
                  </div>
                </div>

                {selectedOrder.status === 'COMPLETED' && (
                  <div className="space-y-1">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resendReceipt}
                      disabled={resendingReceipt}
                    >
                      Resend receipt
                    </Button>
                    {receiptMessage && (
                      <p className="text-center text-xs text-muted-foreground">{receiptMessage}</p>
                    )}
                  </div>
                )}

                {canVoid(selectedOrder) && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive"
                    onClick={() => setVoidOpen(true)}
                  >
                    Void this order
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void order #{selectedOrder?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Reason for voiding"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={submitVoid}
              disabled={!voidReason.trim()}
            >
              Void order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
