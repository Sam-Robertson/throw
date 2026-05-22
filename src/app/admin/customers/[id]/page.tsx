"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMountainTime } from "@/lib/timezone";

type Tab = "bookings" | "membership" | "waivers" | "tasks";

type BookingStatus = "CONFIRMED" | "WAITLIST" | "CANCELLED" | "NO_SHOW";
type BookingSource = "MEMBERSHIP_CREDIT" | "MEMBER_FREE" | "DROP_IN" | "COMP";
type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

interface MembershipEvent {
  id: string;
  eventType: string;
  note: string | null;
  createdAt: string;
}

interface Membership {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  plan: { name: string; price: number };
  membershipEvents: MembershipEvent[];
}

interface Booking {
  id: string;
  status: BookingStatus;
  source: BookingSource;
  amountPaidCents: number;
  createdAt: string;
  studioSession: {
    startsAt: string;
    sessionType: { name: string };
    location: { name: string } | null;
  };
}

interface WaiverSignature {
  id: string;
  signedAt: string;
  ipAddress: string;
  waiverVersion: { version: number };
}

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  createdAt: string;
  assignedTo: { name: string | null; email: string } | null;
}

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  role: string;
  createdAt: string;
  memberships: Membership[];
  bookings: Booking[];
  waiverSignatures: WaiverSignature[];
  linkedTasks: Task[];
}

const BOOKING_STATUS_VARIANT: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  WAITLIST: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "secondary",
};

const TASK_STATUS_VARIANT: Record<TaskStatus, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "outline",
  IN_PROGRESS: "default",
  DONE: "secondary",
  CANCELLED: "destructive",
};

const SOURCE_LABEL: Record<BookingSource, string> = {
  MEMBERSHIP_CREDIT: "Member",
  MEMBER_FREE: "Member",
  DROP_IN: "Drop-in",
  COMP: "Comp",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminCustomerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("bookings");
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEcName, setEditEcName] = useState("");
  const [editEcPhone, setEditEcPhone] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Booking action loading
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);

  // New task dialog
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/customers/${id}`);
    if (res.ok) {
      const data = await res.json() as Customer;
      setCustomer(data);
    } else if (res.status === 404) {
      router.push("/admin/customers");
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: { role?: string } }) => {
        if (data?.user?.role === "ADMIN") setIsAdmin(true);
      });
  }, [load]);

  function openEdit() {
    if (!customer) return;
    setEditName(customer.name ?? "");
    setEditPhone(customer.phone ?? "");
    setEditEcName(customer.emergencyContactName ?? "");
    setEditEcPhone(customer.emergencyContactPhone ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEditSave() {
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        phone: editPhone,
        emergencyContactName: editEcName,
        emergencyContactPhone: editEcPhone,
      }),
    });
    if (res.ok) {
      await load();
      setEditOpen(false);
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setEditError(data.error ?? "Something went wrong");
    }
    setEditSaving(false);
  }

  async function handleMarkNoShow(bookingId: string) {
    setBookingActionId(bookingId);
    await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "NO_SHOW" }),
    });
    await load();
    setBookingActionId(null);
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!customer) return null;

  const activeMembership = customer.memberships.find(
    (m) => m.status === "ACTIVE" || m.status === "PAUSED",
  );

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        href="/admin/customers"
        className="mb-4 block text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Customers
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {customer.name ?? customer.email}
            </h1>
            <Badge variant="outline" className="text-xs">
              {customer.role}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {customer.email}
          </p>
          {customer.phone && (
            <p className="text-sm text-muted-foreground">{customer.phone}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {formatMountainTime(new Date(customer.createdAt), "date")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openEdit}>
          Edit
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b">
        {(["bookings", "membership", "waivers", "tasks"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Bookings tab */}
      {tab === "bookings" && (
        <div>
          {customer.bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings.</p>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-left font-medium">Session</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Source</th>
                    <th className="px-4 py-2 text-left font-medium">Amount</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {customer.bookings.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {b.studioSession.sessionType.name}
                        {b.studioSession.location &&
                          ` · ${b.studioSession.location.name}`}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatMountainTime(
                          new Date(b.studioSession.startsAt),
                          "datetime",
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABEL[b.source]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {b.source === "DROP_IN" && b.amountPaidCents > 0
                          ? formatCents(b.amountPaidCents)
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={BOOKING_STATUS_VARIANT[b.status]}
                          className="text-xs"
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        {b.status === "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={bookingActionId === b.id}
                            onClick={() => handleMarkNoShow(b.id)}
                            className="text-xs"
                          >
                            No-show
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Membership tab */}
      {tab === "membership" && (
        <div className="space-y-6">
          {!activeMembership && (
            <p className="text-sm text-muted-foreground">
              No active membership.
            </p>
          )}

          {activeMembership && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold">{activeMembership.plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCents(activeMembership.plan.price)} / period
                  </p>
                </div>
                <Badge
                  variant={
                    activeMembership.status === "PAUSED"
                      ? "secondary"
                      : "default"
                  }
                >
                  {activeMembership.status}
                </Badge>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-36 text-muted-foreground">Period</dt>
                  <dd>
                    {formatMountainTime(
                      new Date(activeMembership.currentPeriodStart),
                      "date",
                    )}{" "}
                    →{" "}
                    {formatMountainTime(
                      new Date(activeMembership.currentPeriodEnd),
                      "date",
                    )}
                  </dd>
                </div>
                {activeMembership.stripeSubscriptionId && (
                  <div className="flex gap-2">
                    <dt className="w-36 text-muted-foreground">Stripe sub</dt>
                    <dd className="font-mono text-xs">
                      {activeMembership.stripeSubscriptionId}
                    </dd>
                  </div>
                )}
              </dl>

              {isAdmin && (
                <div className="mt-4 flex gap-2">
                  {activeMembership.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch(
                          `/api/admin/memberships/${activeMembership.id}/pause`,
                          { method: "PATCH" },
                        );
                        await load();
                      }}
                    >
                      Pause
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      await fetch(
                        `/api/admin/memberships/${activeMembership.id}/cancel`,
                        { method: "PATCH" },
                      );
                      await load();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Full history */}
          {customer.memberships.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Event Log</h3>
              <div className="space-y-1">
                {customer.memberships.flatMap((m) =>
                  m.membershipEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex gap-3 text-sm text-muted-foreground"
                    >
                      <span className="shrink-0">
                        {formatMountainTime(new Date(ev.createdAt), "datetime")}
                      </span>
                      <span className="font-medium text-foreground">
                        {ev.eventType}
                      </span>
                      {ev.note && <span>{ev.note}</span>}
                    </div>
                  )),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waivers tab */}
      {tab === "waivers" && (
        <div>
          {customer.waiverSignatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signatures.</p>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-left font-medium">Version</th>
                    <th className="px-4 py-2 text-left font-medium">Signed</th>
                    <th className="px-4 py-2 text-left font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.waiverSignatures.map((sig) => (
                    <tr key={sig.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        v{sig.waiverVersion.version}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatMountainTime(new Date(sig.signedAt), "datetime")}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {sig.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tasks tab */}
      {tab === "tasks" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {customer.linkedTasks.length} task
              {customer.linkedTasks.length !== 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              onClick={() => setNewTaskOpen(true)}
            >
              New Task
            </Button>
          </div>

          {customer.linkedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks linked.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {customer.linkedTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tasks`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{t.title}</p>
                    {t.assignedTo && (
                      <p className="text-xs text-muted-foreground">
                        {t.assignedTo.name ?? t.assignedTo.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.dueAt && (
                      <span className="text-xs text-muted-foreground">
                        Due {formatMountainTime(new Date(t.dueAt), "date")}
                      </span>
                    )}
                    <Badge
                      variant={TASK_STATUS_VARIANT[t.status]}
                      className="text-xs"
                    >
                      {t.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit customer dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency contact name</Label>
              <Input
                value={editEcName}
                onChange={(e) => setEditEcName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency contact phone</Label>
              <Input
                type="tel"
                value={editEcPhone}
                onChange={(e) => setEditEcPhone(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Task dialog — pre-filled with this customer */}
      <NewTaskDialog
        open={newTaskOpen}
        customerId={customer.id}
        customerLabel={customer.name ?? customer.email}
        onClose={() => setNewTaskOpen(false)}
        onCreated={load}
      />
    </div>
  );
}

function NewTaskDialog({
  open,
  customerId,
  customerLabel,
  onClose,
  onCreated,
}: {
  open: boolean;
  customerId: string;
  customerLabel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, linkedCustomerId: customerId }),
    });
    if (res.ok) {
      setTitle("");
      setDescription("");
      onClose();
      onCreated();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) { onClose(); setTitle(""); setDescription(""); setError(null); } }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Linked customer</Label>
            <p className="text-sm text-muted-foreground">{customerLabel}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? "Creating…" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
