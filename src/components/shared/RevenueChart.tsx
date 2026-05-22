"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  amountInCents: number;
}

interface Props {
  data: DataPoint[];
}

function groupByWeek(data: DataPoint[]): DataPoint[] {
  const weeks: Record<string, number> = {};
  for (const d of data) {
    const dt = new Date(d.date + "T12:00:00Z");
    // ISO week Monday
    const day = dt.getUTCDay();
    const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt);
    monday.setUTCDate(diff);
    const key = monday.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] ?? 0) + d.amountInCents;
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amountInCents]) => ({ date, amountInCents }));
}

function formatLabel(date: string, grouped: boolean) {
  const dt = new Date(date + "T12:00:00Z");
  if (grouped) return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RevenueChart({ data }: Props) {
  const useWeekly = data.length > 60;
  const chartData = (useWeekly ? groupByWeek(data) : data).map((d) => ({
    label: formatLabel(d.date, useWeekly),
    dollars: d.amountInCents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
          tickLine={false}
        />
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
            return [`$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Revenue"];
          }}
        />
        <Bar dataKey="dollars" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
