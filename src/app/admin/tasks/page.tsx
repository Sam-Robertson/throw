"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMountainTime } from "@/lib/timezone";
import { formatInTimeZone } from "date-fns-tz";
import { TaskForm, type TaskFormValues } from "./_components/TaskForm";
import { TaskDetail } from "./_components/TaskDetail";

const TZ = "America/Denver";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  triggerType: "MANUAL" | "AUTOMATION";
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignedToId: string | null;
  linkedCustomerId: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  linkedCustomer: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null; email: string };
}

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

const STATUS_FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

const STATUS_VARIANT: Record<
  TaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  OPEN: "outline",
  IN_PROGRESS: "default",
  DONE: "secondary",
  CANCELLED: "destructive",
};

function isOverdue(task: StaffTask): boolean {
  if (!task.dueAt) return false;
  if (task.status === "DONE" || task.status === "CANCELLED") return false;
  return new Date(task.dueAt) < new Date();
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");

  // Selected task
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action loading (status changes)
  const [actionLoading, setActionLoading] = useState(false);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  async function loadStaff() {
    const res = await fetch("/api/admin/staff");
    if (res.ok) setStaffList(await res.json());
  }

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (assigneeFilter === "unassigned") params.set("assignedToId", "unassigned");
    else if (assigneeFilter === "me" && currentUserId)
      params.set("assignedToId", currentUserId);
    else if (assigneeFilter !== "all") params.set("assignedToId", assigneeFilter);

    const res = await fetch(`/api/admin/tasks?${params}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [statusFilter, assigneeFilter, currentUserId]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: { id?: string; role?: string } }) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
        if (data?.user?.role === "ADMIN") setIsAdmin(true);
      });
    loadStaff();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Client-side customer name filter
  const filteredTasks = customerSearch.trim()
    ? tasks.filter((t) => {
        const q = customerSearch.toLowerCase();
        return (
          t.linkedCustomer?.name?.toLowerCase().includes(q) ||
          t.linkedCustomer?.email?.toLowerCase().includes(q)
        );
      })
    : tasks;

  async function handleStatusChange(id: string, status: TaskStatus) {
    setActionLoading(true);
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated: StaffTask = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
    setActionLoading(false);
  }

  async function handleFormSubmit(values: TaskFormValues) {
    setFormSaving(true);
    setFormError(null);

    const payload = {
      title: values.title,
      description: values.description || null,
      assignedToId: values.assignedToId || null,
      linkedCustomerId: values.linkedCustomerId || null,
      dueAt: values.dueAt || null,
      ...(editingTask && { status: values.status }),
    };

    const res = editingTask
      ? await fetch(`/api/admin/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError((data as { error?: string }).error ?? "Something went wrong");
      setFormSaving(false);
      return;
    }

    const saved: StaffTask = await res.json();
    if (editingTask) {
      setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } else {
      setTasks((prev) => [saved, ...prev]);
      setSelectedTaskId(saved.id);
    }
    setFormOpen(false);
    setEditingTask(null);
    setFormSaving(false);
  }

  async function handleDelete() {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/admin/tasks/${deleteConfirmId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== deleteConfirmId));
      if (selectedTaskId === deleteConfirmId) setSelectedTaskId(null);
    }
    setDeleteConfirmId(null);
    setDeleteLoading(false);
  }

  function openNew() {
    setEditingTask(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(task: StaffTask) {
    setEditingTask(task);
    setFormError(null);
    setFormOpen(true);
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* ── Left pane: filters + task list ── */}
      <div className="flex w-[42%] shrink-0 flex-col border-r">
        {/* Filter bar */}
        <div className="space-y-2 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Tasks</h1>
            <Button size="sm" onClick={openNew}>
              New Task
            </Button>
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full rounded-md border px-2 py-1 text-sm"
          >
            <option value="all">All staff</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email}
              </option>
            ))}
          </select>

          {/* Customer search */}
          <Input
            placeholder="Filter by customer name or email…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : filteredTasks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No tasks found.</p>
          ) : (
            filteredTasks.map((task) => {
              const overdue = isOverdue(task);
              const selected = task.id === selectedTaskId;
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                    selected ? "bg-accent" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{task.title}</span>
                    <Badge
                      variant={STATUS_VARIANT[task.status]}
                      className="shrink-0 text-xs"
                    >
                      {task.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {task.assignedTo?.name ?? task.assignedTo?.email ?? "Unassigned"}
                    </span>
                    {task.dueAt && (
                      <span className={overdue ? "font-medium text-destructive" : ""}>
                        {overdue ? "⚠ " : ""}
                        {formatMountainTime(new Date(task.dueAt), "date")}
                      </span>
                    )}
                    {task.linkedCustomer && (
                      <span className="truncate">
                        {task.linkedCustomer.name ?? task.linkedCustomer.email}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right pane: task detail ── */}
      <div className="flex-1 overflow-hidden bg-background">
        {selectedTask ? (
          <TaskDetail
            task={selectedTask}
            isAdmin={isAdmin}
            actionLoading={actionLoading}
            onStatusChange={handleStatusChange}
            onEdit={() => openEdit(selectedTask)}
            onDeleteRequest={() => setDeleteConfirmId(selectedTask.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a task to view details
          </div>
        )}
      </div>

      {/* ── New / Edit Task dialog ── */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            key={editingTask?.id ?? "new"}
            initialValues={
              editingTask
                ? {
                    title: editingTask.title,
                    description: editingTask.description ?? "",
                    assignedToId: editingTask.assignedToId ?? "",
                    linkedCustomerId: editingTask.linkedCustomerId ?? "",
                    linkedCustomerLabel:
                      editingTask.linkedCustomer?.name ??
                      editingTask.linkedCustomer?.email ??
                      "",
                    dueAt: editingTask.dueAt
                      ? formatInTimeZone(
                          new Date(editingTask.dueAt),
                          TZ,
                          "yyyy-MM-dd'T'HH:mm",
                        )
                      : "",
                    status: editingTask.status,
                  }
                : undefined
            }
            isEdit={!!editingTask}
            staffList={staffList}
            saving={formSaving}
            error={formError}
            onSubmit={handleFormSubmit}
            onCancel={() => { setFormOpen(false); setEditingTask(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
