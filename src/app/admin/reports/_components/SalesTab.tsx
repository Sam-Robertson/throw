"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SalesRow {
  id: string;
  category: string;
  item: string;
  paymentDate: string;
  serviceDate: string | null;
  saleCents: number;
  taxCents: number;
  discountCents: number;
  refundedCents: number;
  paymentMethod: string;
  paymentStatus: "Paid" | "Voided" | "Refunded";
  reference: string;
  paymentId: string | null;
  soldBy: string;
  customerName: string | null;
  customerEmail: string | null;
  location: string;
  channel: "Register" | "Online";
}

interface LocationRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  range: DateRange;
}

type DateBasis = "payment" | "service";
type SortKey = "paymentDate" | "serviceDate" | "saleCents" | "category" | "item" | "customerName";

const ALL = "__all__";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string | null, withTime = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** Mountain Time yyyy-mm-dd of an instant, for comparing against the picker's days. */
function mtDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const selectClass =
  "min-h-9 rounded-md border border-input bg-background px-2 text-sm";

/**
 * Total sales: every line sold at the register or online, filterable by
 * category, studio, payment method and status, by payment or service date,
 * with totals and a CSV download.
 */
export function SalesTab({ range }: Props) {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [locationId, setLocationId] = useState(ALL);
  const [dateBasis, setDateBasis] = useState<DateBasis>("payment");
  const [category, setCategory] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [channel, setChannel] = useState(ALL);
  const [excludeVoided, setExcludeVoided] = useState(true);
  const [excludeGiftCards, setExcludeGiftCards] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("paymentDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/admin/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LocationRow[]) => setLocations(data.filter((l) => l.isActive)))
      .catch(() => {});
  }, []);

  // By service date the class can be weeks after the sale, so the server is
  // asked for a wider window of payments and the day filter is applied here.
  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (dateBasis === "service") {
      const from = new Date(range.from + "T00:00:00");
      from.setDate(from.getDate() - 120);
      params.set("from", from.toISOString().slice(0, 10));
    }
    if (locationId !== ALL) params.set("locationId", locationId);
    return params;
  }, [range.from, range.to, dateBasis, locationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reports/sales?${query.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to load");
        return r.json() as Promise<{ rows: SalesRow[]; truncated: boolean }>;
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setTruncated(data.truncated);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const methods = useMemo(() => [...new Set(rows.map((r) => r.paymentMethod))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dateBasis === "service") {
        if (!r.serviceDate) return false;
        const day = mtDay(r.serviceDate);
        if (day < range.from || day > range.to) return false;
      }
      if (category !== ALL && r.category !== category) return false;
      if (method !== ALL && r.paymentMethod !== method) return false;
      if (channel !== ALL && r.channel !== channel) return false;
      if (excludeVoided && r.paymentStatus !== "Paid") return false;
      if (excludeGiftCards && r.category === "Gift cards") return false;
      if (
        q &&
        ![r.item, r.customerName ?? "", r.customerEmail ?? "", r.reference, r.soldBy, r.paymentId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [rows, dateBasis, range.from, range.to, category, method, channel, excludeVoided, excludeGiftCards, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => {
          acc.sale += r.saleCents;
          acc.tax += r.taxCents;
          acc.discount += r.discountCents;
          acc.refunded += r.refundedCents;
          return acc;
        },
        { sale: 0, tax: 0, discount: 0, refunded: 0 },
      ),
    [filtered],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; cents: number }>();
    for (const r of filtered) {
      const cur = map.get(r.category) ?? { count: 0, cents: 0 };
      cur.count += 1;
      cur.cents += r.saleCents;
      map.set(r.category, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].cents - a[1].cents);
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "saleCents" || key.endsWith("Date") ? "desc" : "asc");
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  function downloadCsv(kind: "details" | "summary") {
    if (kind === "details") {
      // The filtered rows as shown, not the whole range.
      const header = [
        "Category", "Item", "Payment date", "Service date", "Sale value", "Tax", "Discount", "Refunded",
        "Payment method", "Payment status", "Sale reference", "Payment ID", "Sold by", "Customer name",
        "Customer email", "Location", "Channel",
      ];
      const cell = (v: string | number | null) => {
        if (v === null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = sorted.map((r) =>
        [
          r.category, r.item, fmtDate(r.paymentDate), r.serviceDate ? fmtDate(r.serviceDate) : null,
          (r.saleCents / 100).toFixed(2), (r.taxCents / 100).toFixed(2), (r.discountCents / 100).toFixed(2),
          (r.refundedCents / 100).toFixed(2), r.paymentMethod, r.paymentStatus, r.reference, r.paymentId,
          r.soldBy, r.customerName, r.customerEmail, r.location, r.channel,
        ].map(cell).join(","),
      );
      save([header.join(","), ...lines].join("\n"), `sales-details-${range.from}-to-${range.to}.csv`);
    } else {
      const lines = byCategory.map(([name, v]) => `${name},${v.count},${(v.cents / 100).toFixed(2)}`);
      save(
        ["Category,Items sold,Sales", ...lines, `Total,${filtered.length},${(totals.sale / 100).toFixed(2)}`].join("\n"),
        `sales-summary-${range.from}-to-${range.to}.csv`,
      );
    }
  }

  function save(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total sales" value={fmt(totals.sale)} sub={`${filtered.length} item${filtered.length === 1 ? "" : "s"}`} />
        <Stat label="Tax collected" value={fmt(totals.tax)} />
        <Stat label="Discounts given" value={fmt(totals.discount)} />
        <Stat label={excludeVoided ? "Voided / refunded (hidden)" : "Voided / refunded"} value={fmt(excludeVoided ? rows.filter((r) => r.paymentStatus !== "Paid").reduce((s, r) => s + r.refundedCents, 0) : totals.refunded)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Dates by
          <select className={selectClass} value={dateBasis} onChange={(e) => setDateBasis(e.target.value as DateBasis)}>
            <option value="payment">Payment date</option>
            <option value="service">Service date (class date)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Studio
          <select className={selectClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value={ALL}>All studios</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Category
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value={ALL}>All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Payment method
          <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value={ALL}>All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Sold
          <select className={selectClass} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value={ALL}>Register and online</option>
            <option value="Register">At the register</option>
            <option value="Online">Online</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Search
          <input
            className={cn(selectClass, "min-w-44")}
            placeholder="Item, customer, order #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={excludeVoided} onChange={(e) => setExcludeVoided(e.target.checked)} />
          Exclude voided and refunded
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={excludeGiftCards} onChange={(e) => setExcludeGiftCards(e.target.checked)} />
          Exclude gift card purchases
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCsv("summary")} disabled={filtered.length === 0}>
            Download summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("details")} disabled={filtered.length === 0}>
            Download details
          </Button>
        </div>
      </div>

      {truncated && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          This range has more sales than the report can show at once. Narrow the dates for the full picture.
        </p>
      )}

      {/* By category */}
      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.map(([name, v]) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(category === name ? ALL : name)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                category === name ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {name} · {fmt(v.cents)} <span className="opacity-70">({v.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Rows */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="cursor-pointer px-3 py-2 hover:text-foreground" onClick={() => toggleSort("category")}>Category{arrow("category")}</th>
              <th className="cursor-pointer px-3 py-2 hover:text-foreground" onClick={() => toggleSort("item")}>Item{arrow("item")}</th>
              <th className="cursor-pointer whitespace-nowrap px-3 py-2 hover:text-foreground" onClick={() => toggleSort("paymentDate")}>Payment date{arrow("paymentDate")}</th>
              <th className="cursor-pointer whitespace-nowrap px-3 py-2 hover:text-foreground" onClick={() => toggleSort("serviceDate")}>Service date{arrow("serviceDate")}</th>
              <th className="cursor-pointer px-3 py-2 text-right hover:text-foreground" onClick={() => toggleSort("saleCents")}>Sale{arrow("saleCents")}</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Refunded</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Sold by</th>
              <th className="cursor-pointer px-3 py-2 hover:text-foreground" onClick={() => toggleSort("customerName")}>Customer{arrow("customerName")}</th>
              <th className="px-3 py-2">Studio</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-muted-foreground">No sales match.</td></tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className={cn("border-b last:border-0 hover:bg-muted/30", r.paymentStatus !== "Paid" && "text-muted-foreground")}>
                  <td className="whitespace-nowrap px-3 py-2">{r.category}</td>
                  <td className="max-w-xs px-3 py-2">{r.item}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.paymentDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.serviceDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{fmt(r.saleCents)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{r.taxCents ? fmt(r.taxCents) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{r.refundedCents ? fmt(r.refundedCents) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.paymentMethod}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.paymentStatus}</td>
                  <td className="whitespace-nowrap px-3 py-2" title={r.paymentId ?? undefined}>{r.reference}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.soldBy}</td>
                  <td className="px-3 py-2">
                    {r.customerName ?? "—"}
                    {r.customerEmail && <span className="block text-xs text-muted-foreground">{r.customerEmail}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.location}</td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="px-3 py-2" colSpan={4}>Total ({sorted.length})</td>
                <td className="px-3 py-2 text-right">{fmt(totals.sale)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.tax)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.refunded)}</td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
