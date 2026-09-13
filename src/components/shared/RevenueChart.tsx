"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string; // "yyyy-MM-dd"
  dropInCents: number;
  membershipCents: number;
  otherCents: number;
}

interface Props {
  data: DataPoint[];
}

type Granularity = "week" | "month" | "year";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// Monday-start ISO week key for a given date.
function weekKey(dt: Date): string {
  const day = dt.getUTCDay();
  const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(dt);
  monday.setUTCDate(diff);
  return monday.toISOString().slice(0, 10);
}

function bucketKey(date: string, granularity: Granularity): string {
  const dt = new Date(date + "T12:00:00Z");
  if (granularity === "year") return String(dt.getUTCFullYear());
  if (granularity === "month") return date.slice(0, 7); // yyyy-MM
  return weekKey(dt);
}

function formatLabel(key: string, granularity: Granularity): string {
  if (granularity === "year") return key;
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  const dt = new Date(key + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupData(data: DataPoint[], granularity: Granularity) {
  const buckets = new Map<string, DataPoint>();
  for (const d of data) {
    const key = bucketKey(d.date, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.dropInCents += d.dropInCents;
      existing.membershipCents += d.membershipCents;
      existing.otherCents += d.otherCents;
    } else {
      buckets.set(key, { date: key, dropInCents: d.dropInCents, membershipCents: d.membershipCents, otherCents: d.otherCents });
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      label: formatLabel(key, granularity),
      "Drop-in": bucket.dropInCents / 100,
      Membership: bucket.membershipCents / 100,
      Other: bucket.otherCents / 100,
    }));
}

// Span of the underlying daily data decides a sensible default bucket size;
// the toggle below always lets the user override it.
function defaultGranularity(data: DataPoint[]): Granularity {
  if (data.length > 400) return "year";
  if (data.length > 60) return "month";
  return "week";
}

export function RevenueChart({ data }: Props) {
  const [granularity, setGranularity] = useState<Granularity>(() => defaultGranularity(data));
  const chartData = useMemo(() => groupData(data, granularity), [data, granularity]);

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1">
        {GRANULARITIES.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGranularity(g.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              granularity === g.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(v, name) => {
              const num = typeof v === "number" ? v : 0;
              return [`$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Drop-in" stackId="revenue" fill="#6366f1" />
          <Bar dataKey="Membership" stackId="revenue" fill="#22c55e" />
          <Bar dataKey="Other" stackId="revenue" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
