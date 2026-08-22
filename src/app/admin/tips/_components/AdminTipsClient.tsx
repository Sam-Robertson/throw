"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/shared/DateRangePicker";
import { formatMountainTime } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TipRow {
  id: string;
  createdAt: string;
  amountInCents: number;
  paidOutAt: string | null;
  instructor: { id: string; name: string };
  customer: { id: string; name: string };
  booking: { startsAt: string | null; sessionTypeName: string | null };
}

interface ByInstructor {
  instructorId: string;
  instructorName: string;
  totalAmountCents: number;
  count: number;
  unpaidAmountCents: number;
}

interface TipsResponse {
  tips: TipRow[];
  summary: {
    totalAmountCents: number;
    count: number;
    unpaidAmountCents: number;
    byInstructor: ByInstructor[];
  };
}

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "Sarah Thompson" -> "Sarah T." — used to mask customer names in the admin/staff UI. */
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

async function fetchTips(range: DateRange, instructorId?: string): Promise<TipsResponse> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (instructorId) params.set("instructorId", instructorId);
  const res = await fetch(`/api/admin/tips?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load tips");
  return res.json();
}

export function AdminTipsClient() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [instructorOptions, setInstructorOptions] = useState<ByInstructor[]>([]);
  const [data, setData] = useState<TipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

  // Unfiltered fetch — keeps the instructor filter dropdown populated regardless
  // of what's currently selected in it.
  useEffect(() => {
    fetchTips(range)
      .then((d) => setInstructorOptions(d.summary.byInstructor))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchTips(range, instructorFilter === "all" ? undefined : instructorFilter)
      .then((d) => {
        setData(d);
        setSelected(new Set());
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range, instructorFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const unpaidIds = (data?.tips ?? []).filter((t) => !t.paidOutAt).map((t) => t.id);
  const allUnpaidSelected = unpaidIds.length > 0 && unpaidIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected(allUnpaidSelected ? new Set() : new Set(unpaidIds));
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/admin/tips/${id}/payout`, { method: "PATCH" });
    if (res.ok) load();
  }

  async function markSelectedPaid() {
    if (selected.size === 0) return;
    setMarking(true);
    try {
      const res = await fetch("/api/admin/tips/payout-bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipIds: Array.from(selected) }),
      });
      if (res.ok) load();
    } finally {
      setMarking(false);
    }
  }

  const chartData = (data?.summary.byInstructor ?? []).map((i) => ({
    label: i.instructorName,
    dollars: i.totalAmountCents / 100,
  }));

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Tips</h1>
        <p className="text-sm text-muted-foreground">
          Instructor tips and payout tracking
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <DateRangePicker value={range} onChange={setRange} />

        <div className="space-y-1">
          <Select
            value={instructorFilter}
            onValueChange={(v) => setInstructorFilter(v)}
          >
            <SelectTrigger className="h-8 w-56 text-sm">
              <SelectValue placeholder="All instructors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Instructors</SelectItem>
              {instructorOptions.map((i) => (
                <SelectItem key={i.instructorId} value={i.instructorId}>
                  {i.instructorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading tips…</p>}
      {error && <p className="text-sm text-destructive">Failed to load tips.</p>}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Tips</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtMoney(data.summary.totalAmountCents)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Tip Count</p>
              <p className="mt-1 text-2xl font-semibold">{data.summary.count.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Unpaid Tips</p>
              <p className="mt-1 text-2xl font-semibold text-destructive">
                {fmtMoney(data.summary.unpaidAmountCents)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Instructors Tipped</p>
              <p className="mt-1 text-2xl font-semibold">
                {data.summary.byInstructor.length.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">Tips by Instructor</h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tips in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(v) => {
                      const num = typeof v === "number" ? v : 0;
                      return [
                        `$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                        "Tips",
                      ];
                    }}
                  />
                  <Bar dataKey="dollars" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="text-sm font-medium">Tip Log</h3>
                <p className="text-xs text-muted-foreground">
                  {data.tips.length.toLocaleString()} tips in this period
                </p>
              </div>
              <Button
                size="sm"
                onClick={markSelectedPaid}
                disabled={selected.size === 0 || marking}
              >
                Mark selected as paid out
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={allUnpaidSelected}
                        onChange={toggleSelectAll}
                        disabled={unpaidIds.length === 0}
                        aria-label="Select all unpaid tips"
                      />
                    </th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Instructor</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Session Type</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.tips.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={selected.has(t.id)}
                          onChange={() => toggleRow(t.id)}
                          disabled={!!t.paidOutAt}
                          aria-label={`Select tip from ${t.customer.name}`}
                        />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatMountainTime(new Date(t.createdAt), "date")}
                      </td>
                      <td className="px-4 py-2">{t.instructor.name}</td>
                      <td className="px-4 py-2">{maskName(t.customer.name)}</td>
                      <td className="px-4 py-2">{t.booking.sessionTypeName ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {fmtMoney(t.amountInCents)}
                      </td>
                      <td className="px-4 py-2">
                        {t.paidOutAt ? (
                          <Badge variant="secondary">Paid</Badge>
                        ) : (
                          <Badge variant="outline">Unpaid</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!t.paidOutAt && (
                          <Button size="sm" variant="outline" onClick={() => markPaid(t.id)}>
                            Mark paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.tips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
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
