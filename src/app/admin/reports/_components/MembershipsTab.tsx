"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";
import { Badge } from "@/components/ui/badge";

interface MembershipSummary {
  activeCount: number;
  pausedCount: number;
  expiredCount: number;
  newCount: number;
  cancelledCount: number;
  mrrCents: number;
}

interface PlanBreakdown {
  name: string;
  count: number;
}

interface EventRow {
  id: string;
  date: string;
  customerName: string;
  eventType: string;
  planName: string;
  note: string | null;
}

interface MembershipsData {
  summary: MembershipSummary;
  byPlan: PlanBreakdown[];
  events: EventRow[];
}

interface Props {
  range: DateRange;
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function eventBadgeVariant(
  type: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "CREATED":
      return "default";
    case "CANCELLED":
      return "destructive";
    case "PAUSED":
      return "secondary";
    case "RESUMED":
    case "RENEWED":
      return "outline";
    default:
      return "outline";
  }
}

function eventTypeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MembershipsTab({ range }: Props) {
  const [data, setData] = useState<MembershipsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/admin/reports/memberships?from=${range.from}&to=${range.to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: MembershipsData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range.from, range.to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading memberships…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Failed to load membership data.</p>;

  const { summary, byPlan, events } = data;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Members" value={summary.activeCount.toLocaleString()} />
        <StatCard label="New Signups" value={summary.newCount.toLocaleString()} sub="in date range" />
        <StatCard label="Cancellations" value={summary.cancelledCount.toLocaleString()} sub="in date range" />
        <StatCard label="Paused" value={summary.pausedCount.toLocaleString()} />
        <StatCard label="Expired" value={summary.expiredCount.toLocaleString()} />
        <StatCard label="MRR" value={fmt(summary.mrrCents)} sub="monthly recurring" />
      </div>

      {/* By plan */}
      {byPlan.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {byPlan.map((p) => (
            <div key={p.name} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Active · {p.name}</p>
              <p className="mt-1 text-xl font-semibold">{p.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staff performance placeholder */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Staff Attribution</span> — coming soon.
        Requires linking membership creation to a staff session.
      </div>

      {/* Membership events */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Membership Events</h3>
          <p className="text-xs text-muted-foreground">
            {events.length} events in date range · newest first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-US", {
                      timeZone: "America/Denver",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.customerName}</td>
                  <td className="px-4 py-2">
                    <Badge variant={eventBadgeVariant(e.eventType)}>
                      {eventTypeLabel(e.eventType)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{e.planName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.note ?? "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No membership events in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
