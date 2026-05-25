"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MembershipStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";

interface MembershipEvent {
  id: string;
  eventType: string;
  note: string | null;
  createdAt: string;
}

interface Membership {
  id: string;
  status: MembershipStatus;
  currentPeriodEnd: string;
  stripeSubscriptionId: string | null;
  user: { name: string | null; email: string };
  plan: { name: string };
  membershipEvents?: MembershipEvent[];
}

const STATUS_FILTERS = ["ALL", "ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"] as const;
type Filter = (typeof STATUS_FILTERS)[number];

const STATUS_VARIANT: Record<MembershipStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "outline",
};

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

export default function AdminMembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, MembershipEvent[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: { role?: string } }) => {
        setIsAdmin(data?.user?.role === "ADMIN");
      });
    fetch("/api/admin/memberships")
      .then((r) => r.json())
      .then((data) => { setMemberships(data); setLoading(false); });
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!events[id]) {
      const res = await fetch(`/api/admin/memberships/${id}/events`);
      if (res.ok) {
        const data: MembershipEvent[] = await res.json();
        setEvents((prev) => ({ ...prev, [id]: data }));
      }
    }
  }

  async function adminAction(id: string, action: "cancel" | "pause") {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/memberships/${id}/${action}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? `Failed to ${action} membership`);
        return;
      }
      // Refresh memberships list and events for this row
      const [membershipsRes, eventsRes] = await Promise.all([
        fetch("/api/admin/memberships").then((r) => r.json()),
        fetch(`/api/admin/memberships/${id}/events`).then((r) => r.json()),
      ]);
      setMemberships(membershipsRes);
      setEvents((prev) => ({ ...prev, [id]: eventsRes }));
    } finally {
      setActionLoading(null);
    }
  }

  const filtered =
    filter === "ALL" ? memberships : memberships.filter((m) => m.status === filter);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Active Memberships</h1>
      </div>

      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period Ends</TableHead>
            <TableHead>Subscription ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((m) => (
            <>
              <TableRow
                key={m.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(m.id)}
              >
                <TableCell className="font-medium">{m.user.name ?? "—"}</TableCell>
                <TableCell>{m.user.email}</TableCell>
                <TableCell>{m.plan.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(m.currentPeriodEnd).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {truncate(m.stripeSubscriptionId, 16)}
                </TableCell>
              </TableRow>
              {expandedId === m.id && (
                <TableRow key={`${m.id}-events`}>
                  <TableCell colSpan={6} className="bg-muted/30 px-6 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Membership Events
                    </p>
                    {!events[m.id] ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : events[m.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events.</p>
                    ) : (
                      <ul className="mb-4 space-y-1">
                        {events[m.id].map((ev) => (
                          <li key={ev.id} className="flex gap-3 text-sm">
                            <span className="font-mono text-xs text-muted-foreground">
                              {new Date(ev.createdAt).toLocaleString()}
                            </span>
                            <span className="font-medium">{ev.eventType}</span>
                            {ev.note && (
                              <span className="text-muted-foreground">{ev.note}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2 border-t pt-3">
                        {m.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading !== null}
                            onClick={(e) => { e.stopPropagation(); adminAction(m.id, "pause"); }}
                          >
                            {actionLoading === `${m.id}-pause` ? "Pausing…" : "Pause Membership"}
                          </Button>
                        )}
                        {(m.status === "ACTIVE" || m.status === "PAUSED") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLoading !== null}
                            onClick={(e) => { e.stopPropagation(); adminAction(m.id, "cancel"); }}
                          >
                            {actionLoading === `${m.id}-cancel` ? "Cancelling…" : "Cancel Membership"}
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No memberships found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
