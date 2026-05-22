"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";

interface AdSummary {
  total: number;
  attributedBookings: number;
  attributedPurchases: number;
  conversionRate: number;
}

interface UtmRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  bookings: number;
  purchases: number;
  conversionRate: number;
}

interface AdTrackingData {
  summary: AdSummary;
  utmBreakdown: UtmRow[];
}

interface Props {
  range: DateRange;
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function AdTrackingTab({ range }: Props) {
  const [data, setData] = useState<AdTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/admin/reports/ad-tracking?from=${range.from}&to=${range.to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: AdTrackingData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range.from, range.to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading ad tracking…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Failed to load ad tracking data.</p>;

  const { summary, utmBreakdown } = data;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Tracked Sessions"
          value={summary.total.toLocaleString()}
        />
        <StatCard
          label="Attributed Bookings"
          value={summary.attributedBookings.toLocaleString()}
        />
        <StatCard
          label="Attributed Purchases"
          value={summary.attributedPurchases.toLocaleString()}
        />
        <StatCard
          label="Booking Conversion Rate"
          value={pct(summary.conversionRate)}
        />
      </div>

      {/* UTM breakdown */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">UTM Breakdown</h3>
          <p className="text-xs text-muted-foreground">
            Grouped by source · medium · campaign — ordered by sessions desc
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Medium</th>
                <th className="px-4 py-2">Campaign</th>
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2 text-right">Bookings</th>
                <th className="px-4 py-2 text-right">Purchases</th>
                <th className="px-4 py-2 text-right">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {utmBreakdown.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{row.source ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.medium ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.campaign ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{row.sessions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{row.bookings.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{row.purchases.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {pct(row.conversionRate)}
                  </td>
                </tr>
              ))}
              {utmBreakdown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No UTM-tagged sessions in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Landing pages placeholder */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Top Landing Pages</span> — not yet
        available. A <code className="font-mono text-xs">landingPath</code> field is not
        currently stored in the AdTracking model. Add it to the schema to enable this report.
      </div>
    </div>
  );
}
