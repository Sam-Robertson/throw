"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";
import { RevenueChart } from "@/components/shared/RevenueChart";

interface OverviewData {
  totalRevenue: number;
  dropInRevenue: number;
  membershipRevenue: number;
  newMembers: number;
  activeMembers: number;
  totalBookings: number;
  cancellations: number;
  avgBookingsPerMember: number;
  revenueByDay: { date: string; amountInCents: number }[];
}

interface Props {
  range: DateRange;
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function OverviewTab({ range }: Props) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/admin/reports/overview?from=${range.from}&to=${range.to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: OverviewData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range.from, range.to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading overview…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Failed to load overview data.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={fmt(data.totalRevenue)} />
        <StatCard label="Drop-in Revenue" value={fmt(data.dropInRevenue)} />
        <StatCard label="Membership Revenue" value={fmt(data.membershipRevenue)} />
        <StatCard label="New Members" value={data.newMembers.toLocaleString()} />
        <StatCard label="Active Members" value={data.activeMembers.toLocaleString()} />
        <StatCard label="Total Bookings" value={data.totalBookings.toLocaleString()} />
        <StatCard label="Cancellations" value={data.cancellations.toLocaleString()} />
        <StatCard
          label="Avg Bookings / Member"
          value={data.avgBookingsPerMember.toFixed(1)}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-medium">Revenue Over Time</h3>
        <RevenueChart data={data.revenueByDay} />
      </div>
    </div>
  );
}
