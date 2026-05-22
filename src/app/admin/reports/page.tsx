"use client";

import { useState, useEffect } from "react";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/shared/DateRangePicker";
import { OverviewTab } from "./_components/OverviewTab";
import { RevenueTab } from "./_components/RevenueTab";
import { MembershipsTab } from "./_components/MembershipsTab";
import { AttendanceTab } from "./_components/AttendanceTab";
import { AdTrackingTab } from "./_components/AdTrackingTab";
import { cn } from "@/lib/utils";

type TabId = "overview" | "revenue" | "memberships" | "attendance" | "ad-tracking";

interface Permissions {
  role: string;
  canViewMembershipReporting: boolean;
  canViewTips: boolean;
}

interface PermCheck {
  loaded: boolean;
  allowed: boolean;
  permissions: Permissions | null;
}

// Small hook to detect what tabs this user can access
function usePermissions(): PermCheck {
  const [state, setState] = useState<PermCheck>({
    loaded: false,
    allowed: false,
    permissions: null,
  });

  useEffect(() => {
    // Hit the overview endpoint — if it returns 403 they have no admin access.
    // For staff-level tab visibility we fetch a lightweight check.
    fetch("/api/admin/reports/overview?from=2000-01-01&to=2000-01-01")
      .then(async (r) => {
        if (r.status === 401) {
          // Not logged in — layout handles redirect but be safe
          setState({ loaded: true, allowed: false, permissions: null });
          return;
        }
        if (r.status === 200) {
          // ADMIN
          setState({
            loaded: true,
            allowed: true,
            permissions: {
              role: "ADMIN",
              canViewMembershipReporting: true,
              canViewTips: true,
            },
          });
          return;
        }
        // 403: might be STAFF — check memberships access
        const memR = await fetch(
          "/api/admin/reports/memberships?from=2000-01-01&to=2000-01-01",
        );
        setState({
          loaded: true,
          allowed: true, // STAFF can always see Attendance
          permissions: {
            role: "STAFF",
            canViewMembershipReporting: memR.ok,
            canViewTips: false, // Revenue is ADMIN-only in our routes
          },
        });
      })
      .catch(() => setState({ loaded: true, allowed: false, permissions: null }));
  }, []);

  return state;
}

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "revenue", label: "Revenue" },
  { id: "memberships", label: "Memberships" },
  { id: "attendance", label: "Attendance" },
  { id: "ad-tracking", label: "Ad Tracking" },
];

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { loaded, allowed, permissions } = usePermissions();

  // Compute visible tabs
  const visibleTabs = ALL_TABS.filter((t) => {
    if (!permissions) return false;
    if (permissions.role === "ADMIN") return true;
    // STAFF
    if (t.id === "attendance") return true;
    if (t.id === "memberships") return permissions.canViewMembershipReporting;
    if (t.id === "revenue") return permissions.canViewTips;
    return false; // overview, ad-tracking
  });

  // Ensure active tab is visible once permissions load
  useEffect(() => {
    if (!loaded) return;
    if (!visibleTabs.find((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? "attendance");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!allowed || visibleTabs.length === 0) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-destructive">
          You don&apos;t have permission to view reports. Contact your administrator.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Studio analytics and insights</p>
      </div>

      {/* Date range picker */}
      <DateRangePicker value={range} onChange={setRange} />

      {/* Tab nav */}
      <div className="flex gap-0.5 border-b">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === t.id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && permissions?.role === "ADMIN" && (
          <OverviewTab range={range} />
        )}
        {activeTab === "revenue" && permissions?.role === "ADMIN" && (
          <RevenueTab range={range} />
        )}
        {activeTab === "memberships" && (
          <MembershipsTab range={range} />
        )}
        {activeTab === "attendance" && (
          <AttendanceTab range={range} />
        )}
        {activeTab === "ad-tracking" && permissions?.role === "ADMIN" && (
          <AdTrackingTab range={range} />
        )}
      </div>
    </main>
  );
}
