"use client";

import { useCallback, useEffect, useState } from "react";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/shared/DateRangePicker";
import { formatMountainTime } from "@/lib/timezone";
import { Button } from "@/components/ui/button";

interface StaffTipRow {
  id: string;
  createdAt: string;
  amountInCents: number;
  paidOutAt: string | null;
  customerName: string;
  sessionTypeName: string | null;
  startsAt: string | null;
}

interface StaffTipsResponse {
  tips: StaffTipRow[];
  summary: {
    totalAmountCents: number;
    count: number;
    unpaidAmountCents: number;
    allTimeTotalCents: number;
  };
}

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "Sarah Thompson" -> "Sarah T." */
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function StaffTipsClient() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<StaffTipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    fetch(`/api/staff/tips?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: StaffTipsResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex flex-col gap-6 p-8 print:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Tips</h1>
          <p className="text-sm text-muted-foreground">Use this for your tip sheet.</p>
        </div>
        <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div className="print:hidden">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading tips…</p>}
      {error && <p className="text-sm text-destructive">Failed to load tips.</p>}

      {!loading && !error && data && (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">This Period</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtMoney(data.summary.totalAmountCents)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">All Time</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtMoney(data.summary.allTimeTotalCents)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Awaiting Payout</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtMoney(data.summary.unpaidAmountCents)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Session Type</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Paid Out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tips.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatMountainTime(new Date(t.createdAt), "date")}
                      </td>
                      <td className="px-4 py-2">{maskName(t.customerName)}</td>
                      <td className="px-4 py-2">{t.sessionTypeName ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {fmtMoney(t.amountInCents)}
                      </td>
                      <td className="px-4 py-2">{t.paidOutAt ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {data.tips.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No tips in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
