'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatMoney, type Location } from '../../_components/types';

interface DrawerPerson {
  id: string;
  name: string | null;
  email: string;
}

interface CashDrawer {
  id: string;
  locationId: string;
  openedById: string;
  closedById: string | null;
  openingFloatCents: number;
  expectedCashCents: number | null;
  countedCashCents: number | null;
  varianceCents: number | null;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
  openedBy?: DrawerPerson;
  closedBy?: DrawerPerson | null;
}

const VARIANCE_ALERT_CENTS = 500; // $5

function varianceClass(varianceCents: number) {
  return Math.abs(varianceCents) > VARIANCE_ALERT_CENTS ? 'text-red-600 font-semibold' : '';
}

export function DrawerClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');

  const [current, setCurrent] = useState<CashDrawer | null>(null);
  const [expectedCashCents, setExpectedCashCents] = useState(0);
  const [cashPaymentCount, setCashPaymentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<CashDrawer[]>([]);

  useEffect(() => {
    fetch('/api/admin/locations')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Location[]) => {
        setLocations(data);
        const first = data.find((l) => l.isActive) ?? data[0];
        if (first) setLocationId(first.id);
      });
  }, []);

  async function refresh() {
    if (!locationId) return;
    setLoading(true);
    const [currentRes, historyRes] = await Promise.all([
      fetch(`/api/pos/drawer/current?locationId=${locationId}`),
      fetch(`/api/pos/drawer/history?locationId=${locationId}`),
    ]);
    if (currentRes.ok) {
      const data = (await currentRes.json()) as {
        drawer: CashDrawer | null;
        expectedCashCents?: number;
        cashPaymentCount?: number;
      };
      setCurrent(data.drawer);
      setExpectedCashCents(data.expectedCashCents ?? 0);
      setCashPaymentCount(data.cashPaymentCount ?? 0);
    }
    if (historyRes.ok) {
      const data = (await historyRes.json()) as { drawers: CashDrawer[] };
      setHistory(data.drawers);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function openDrawer() {
    const cents = Math.round(parseFloat(openingFloat || '0') * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/pos/drawer/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, openingFloatCents: cents }),
    });
    if (res.ok) {
      setOpeningFloat('');
      await refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to open drawer');
    }
    setBusy(false);
  }

  async function closeDrawer() {
    const cents = Math.round(parseFloat(countedCash || '0') * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/pos/drawer/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, countedCashCents: cents, note: closeNote || undefined }),
    });
    if (res.ok) {
      setCountedCash('');
      setCloseNote('');
      await refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to close drawer');
    }
    setBusy(false);
  }

  const liveVarianceCents = countedCash
    ? Math.round(parseFloat(countedCash) * 100) - expectedCashCents
    : 0;

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Cash Drawer</h1>
        <p className="text-sm text-muted-foreground">Open, close, and reconcile the cash drawer</p>
      </div>

      {locations.length > 1 && (
        <div className="max-w-xs space-y-1">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : current ? (
        <div className="max-w-xl space-y-4 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Drawer is open</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Opened by</dt>
            <dd>{current.openedBy?.name ?? current.openedBy?.email ?? '—'}</dd>
            <dt className="text-muted-foreground">Opened at</dt>
            <dd>{new Date(current.openedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Opening float</dt>
            <dd>{formatMoney(current.openingFloatCents)}</dd>
            <dt className="text-muted-foreground">Expected cash</dt>
            <dd className="font-semibold">{formatMoney(expectedCashCents)}</dd>
            <dt className="text-muted-foreground">Cash payments</dt>
            <dd>{cashPaymentCount}</dd>
          </dl>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-sm font-medium">Counted cash</Label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              className="min-h-11 text-base"
            />
            {countedCash && (
              <p className={cn('text-sm', varianceClass(liveVarianceCents))}>
                Variance: {liveVarianceCents >= 0 ? '+' : ''}{formatMoney(liveVarianceCents)}
              </p>
            )}
            <Input
              placeholder="Note (optional)"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="min-h-11 text-base"
            />
            <Button className="min-h-11 w-full" onClick={closeDrawer} disabled={busy || !countedCash}>
              Close drawer
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-xl space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">No drawer is open</h2>
          <Label className="text-sm font-medium">Opening float</Label>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className="min-h-11 text-base"
          />
          <Button className="min-h-11 w-full" onClick={openDrawer} disabled={busy || !locationId}>
            Open drawer
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <h2 className="border-b p-4 font-semibold">History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Opened</th>
                <th className="px-4 py-2">Closed</th>
                <th className="px-4 py-2">Opened by</th>
                <th className="px-4 py-2">Closed by</th>
                <th className="px-4 py-2 text-right">Float</th>
                <th className="px-4 py-2 text-right">Expected</th>
                <th className="px-4 py-2 text-right">Counted</th>
                <th className="px-4 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No closed drawers yet.
                  </td>
                </tr>
              ) : (
                history.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{new Date(d.openedAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{d.closedAt ? new Date(d.closedAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2">{d.openedBy?.name ?? d.openedBy?.email ?? '—'}</td>
                    <td className="px-4 py-2">{d.closedBy?.name ?? d.closedBy?.email ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(d.openingFloatCents)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(d.expectedCashCents ?? 0)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(d.countedCashCents ?? 0)}</td>
                    <td className={cn('px-4 py-2 text-right', varianceClass(d.varianceCents ?? 0))}>
                      {(d.varianceCents ?? 0) >= 0 ? '+' : ''}{formatMoney(d.varianceCents ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
