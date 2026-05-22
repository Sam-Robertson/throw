"use client";

import { useEffect, useState, useCallback } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PaymentRow {
  id: string;
  date: string;
  type: string;
  customerName: string;
  amountInCents: number;
}

interface RevenueData {
  payments: PaymentRow[];
  totalRevenue: number;
  totalCount: number;
  page: number;
  totalPages: number;
  refunds: PaymentRow[];
  totalRefunded: number;
}

interface Props {
  range: DateRange;
}

const PAGE_SIZE = 50;

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function typeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeBadgeVariant(
  type: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "DROP_IN":
      return "default";
    case "MEMBERSHIP":
      return "secondary";
    case "TIP":
      return "outline";
    default:
      return "outline";
  }
}

function PaymentsTable({
  rows,
  totalLabel,
  totalCents,
}: {
  rows: PaymentRow[];
  totalLabel: string;
  totalCents: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (sortKey === "amount") cmp = a.amountInCents - b.amountInCents;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th
              className="cursor-pointer px-4 py-2 hover:text-foreground"
              onClick={() => toggleSort("date")}
            >
              Date{arrow("date")}
            </th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Customer</th>
            <th
              className="cursor-pointer px-4 py-2 text-right hover:text-foreground"
              onClick={() => toggleSort("amount")}
            >
              Amount{arrow("amount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(p.date).toLocaleDateString("en-US", {
                  timeZone: "America/Denver",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-2">
                <Badge variant={typeBadgeVariant(p.type)}>{typeLabel(p.type)}</Badge>
              </td>
              <td className="px-4 py-2">{p.customerName}</td>
              <td className="px-4 py-2 text-right font-medium">{fmt(p.amountInCents)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                No transactions in this period.
              </td>
            </tr>
          )}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/20 font-semibold">
              <td colSpan={3} className="px-4 py-2 text-right text-sm">
                {totalLabel}
              </td>
              <td className="px-4 py-2 text-right">{fmt(totalCents)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function RevenueTab({ range }: Props) {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(
    (p: number) => {
      setLoading(true);
      setError(false);
      fetch(
        `/api/admin/reports/revenue?from=${range.from}&to=${range.to}&page=${p}&limit=${PAGE_SIZE}`,
      )
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((d: RevenueData) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    },
    [range.from, range.to],
  );

  useEffect(() => {
    setPage(1);
    fetchData(1);
  }, [fetchData]);

  function handlePage(p: number) {
    setPage(p);
    fetchData(p);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading revenue…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Failed to load revenue data.</p>;

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="mt-1 text-2xl font-semibold">{fmt(data.totalRevenue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Refunded</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">
            {fmt(data.totalRefunded)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="mt-1 text-2xl font-semibold">{data.totalCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Payments table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Revenue Breakdown</h3>
          <p className="text-xs text-muted-foreground">Succeeded payments — click columns to sort</p>
        </div>
        <PaymentsTable
          rows={data.payments}
          totalLabel="Page Total"
          totalCents={data.payments.reduce((s, p) => s + p.amountInCents, 0)}
        />
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {data.totalPages} &middot; {data.totalCount} transactions
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePage(page - 1)}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePage(page + 1)}
                disabled={page === data.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Refunds */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Refunds</h3>
        </div>
        {data.refunds.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No refunds in this period.</p>
        ) : (
          <PaymentsTable
            rows={data.refunds}
            totalLabel="Total Refunded"
            totalCents={data.totalRefunded}
          />
        )}
      </div>
    </div>
  );
}
