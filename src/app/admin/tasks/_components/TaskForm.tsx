"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatInTimeZone } from "date-fns-tz";
import { fromZonedTime } from "date-fns-tz";

const TZ = "America/Denver";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface CustomerResult {
  id: string;
  name: string | null;
  email: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  assignedToId: string;
  linkedCustomerId: string;
  linkedCustomerLabel: string;
  dueAt: string;
  status: string;
}

interface Props {
  initialValues?: Partial<TaskFormValues>;
  isEdit?: boolean;
  staffList: StaffUser[];
  saving: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

export function TaskForm({
  initialValues,
  isEdit = false,
  staffList,
  saving,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [assignedToId, setAssignedToId] = useState(initialValues?.assignedToId ?? "");
  const [linkedCustomerId, setLinkedCustomerId] = useState(
    initialValues?.linkedCustomerId ?? "",
  );
  const [customerQuery, setCustomerQuery] = useState(
    initialValues?.linkedCustomerLabel ?? "",
  );
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dueAt, setDueAt] = useState(toInputValue(initialValues?.dueAt));
  const [status, setStatus] = useState(initialValues?.status ?? "OPEN");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCustomerInput(value: string) {
    setCustomerQuery(value);
    setLinkedCustomerId("");
    clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setCustomerResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data: CustomerResult[] = await res.json();
        setCustomerResults(data);
        setShowDropdown(true);
      }
    }, 250);
  }

  function selectCustomer(c: CustomerResult) {
    setLinkedCustomerId(c.id);
    setCustomerQuery(c.name ?? c.email);
    setShowDropdown(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let dueAtIso = "";
    if (dueAt) {
      try {
        dueAtIso = fromZonedTime(dueAt, TZ).toISOString();
      } catch {
        dueAtIso = "";
      }
    }
    onSubmit({
      title,
      description,
      assignedToId,
      linkedCustomerId,
      linkedCustomerLabel: customerQuery,
      dueAt: dueAtIso,
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title *</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="task-assignee">Assigned to</Label>
          <select
            id="task-assignee"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-due">Due date (Mountain Time)</Label>
          <Input
            id="task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5 relative" ref={dropdownRef}>
        <Label htmlFor="task-customer">Linked customer</Label>
        <Input
          id="task-customer"
          value={customerQuery}
          onChange={(e) => handleCustomerInput(e.target.value)}
          placeholder="Search by name or email…"
          autoComplete="off"
        />
        {showDropdown && customerResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            {customerResults.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => selectCustomer(c)}
              >
                <span className="font-medium">{c.name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{c.email}</span>
              </button>
            ))}
          </div>
        )}
        {linkedCustomerId && (
          <p className="text-xs text-muted-foreground">
            Customer linked ·{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setLinkedCustomerId("");
                setCustomerQuery("");
              }}
            >
              clear
            </button>
          </p>
        )}
      </div>

      {isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="task-status">Status</Label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
