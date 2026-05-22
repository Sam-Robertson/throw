"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/components/shared/DateRangePicker";
import { cn } from "@/lib/utils";

interface AttendanceStats {
  totalSessions: number;
  totalCheckIns: number;
  noShows: number;
  avgAttendanceRate: number;
  waitlistConversions: number;
}

interface SessionRow {
  id: string;
  startsAt: string;
  sessionType: string;
  instructor: string | null;
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  attendanceRate: number;
}

interface HeatmapPoint {
  dayOfWeek: number; // 0=Sun..6=Sat
  hour: number; // 8-20
  avgRate: number; // 0-1
}

interface AttendanceData {
  stats: AttendanceStats;
  sessions: SessionRow[];
  heatmap: HeatmapPoint[];
}

interface Props {
  range: DateRange;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

function rateColor(rate: number): string {
  // white → indigo, interpolated
  const r = Math.round(255 - rate * (255 - 99));
  const g = Math.round(255 - rate * (255 - 102));
  const b = Math.round(255 - rate * (255 - 241));
  return `rgb(${r},${g},${b})`;
}

function fmtTime(hour: number) {
  if (hour === 12) return "12 pm";
  if (hour > 12) return `${hour - 12} pm`;
  return `${hour} am`;
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

function Heatmap({ data }: { data: HeatmapPoint[] }) {
  // Build lookup
  const map: Record<string, number> = {};
  for (const p of data) {
    map[`${p.dayOfWeek}_${p.hour}`] = p.avgRate;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid text-xs"
        style={{
          gridTemplateColumns: `3rem repeat(7, 1fr)`,
        }}
      >
        {/* header row */}
        <div />
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {/* rows: one per hour */}
        {HOURS.map((hour) => (
          <>
            <div
              key={`label-${hour}`}
              className="flex items-center pr-2 text-right text-muted-foreground"
            >
              {fmtTime(hour)}
            </div>
            {DOW_LABELS.map((_, dow) => {
              const rate = map[`${dow}_${hour}`] ?? 0;
              const hasData = `${dow}_${hour}` in map && map[`${dow}_${hour}`] > 0;
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={hasData ? `${Math.round(rate * 100)}% avg attendance` : "No sessions"}
                  className="m-0.5 h-8 rounded"
                  style={{ backgroundColor: hasData ? rateColor(rate) : "#f3f4f6" }}
                />
              );
            })}
          </>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Color: white = no data · indigo = 100% full
      </p>
    </div>
  );
}

export function AttendanceTab({ range }: Props) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/admin/reports/attendance?from=${range.from}&to=${range.to}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: AttendanceData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [range.from, range.to]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading attendance…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Failed to load attendance data.</p>;

  const { stats, sessions, heatmap } = data;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Sessions Held"
          value={stats.totalSessions.toLocaleString()}
          sub="completed · not cancelled"
        />
        <StatCard
          label="Total Check-ins"
          value={stats.totalCheckIns.toLocaleString()}
          sub="confirmed + no-show"
        />
        <StatCard
          label="Avg Attendance Rate"
          value={`${Math.round(stats.avgAttendanceRate * 100)}%`}
        />
        <StatCard
          label="No-shows"
          value={stats.noShows.toLocaleString()}
        />
        <StatCard
          label="Waitlist (approx.)"
          value={stats.waitlistConversions.toLocaleString()}
          sub="current waitlist bookings"
        />
      </div>

      {/* Sessions table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Sessions</h3>
          <p className="text-xs text-muted-foreground">
            Completed sessions in date range ·{" "}
            <span className="text-green-700">green = &gt;90%</span> ·{" "}
            <span className="text-amber-600">amber = &lt;30%</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Date / Time</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Instructor</th>
                <th className="px-4 py-2 text-right">Cap.</th>
                <th className="px-4 py-2 text-right">Booked</th>
                <th className="px-4 py-2 text-right">Waitlist</th>
                <th className="px-4 py-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const pct = Math.round(s.attendanceRate * 100);
                const rowCls =
                  s.attendanceRate > 0.9
                    ? "bg-green-50"
                    : s.attendanceRate < 0.3
                      ? "bg-amber-50"
                      : "";
                return (
                  <tr
                    key={s.id}
                    className={cn("border-b last:border-0 hover:bg-muted/30", rowCls)}
                  >
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(s.startsAt).toLocaleString("en-US", {
                        timeZone: "America/Denver",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2">{s.sessionType}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.instructor ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{s.capacity}</td>
                    <td className="px-4 py-2 text-right">{s.confirmedCount}</td>
                    <td className="px-4 py-2 text-right">{s.waitlistCount}</td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-medium",
                        pct > 90 ? "text-green-700" : pct < 30 ? "text-amber-600" : "",
                      )}
                    >
                      {pct}%
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No completed sessions in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popular times heatmap */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-medium">Popular Times</h3>
        <Heatmap data={heatmap} />
      </div>
    </div>
  );
}
