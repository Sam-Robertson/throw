"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMountainTime } from "@/lib/timezone";

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

interface Props {
  task: StaffTask;
  isAdmin: boolean;
  actionLoading: boolean;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
}

export function TaskDetail({
  task,
  isAdmin,
  actionLoading,
  onStatusChange,
  onEdit,
  onDeleteRequest,
}: Props) {
  const overdue = isOverdue(task);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold leading-snug">{task.title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
            {task.triggerType === "AUTOMATION" && (
              <Badge variant="outline">Automation</Badge>
            )}
            {overdue && (
              <Badge variant="destructive">Overdue</Badge>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onDeleteRequest}
              disabled={actionLoading}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {task.description}
        </p>
      )}

      {/* Status actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {task.status === "OPEN" && (
          <Button
            size="sm"
            onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
            disabled={actionLoading}
          >
            Start
          </Button>
        )}
        {(task.status === "OPEN" || task.status === "IN_PROGRESS") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusChange(task.id, "DONE")}
            disabled={actionLoading}
          >
            Complete
          </Button>
        )}
        {task.status !== "DONE" && task.status !== "CANCELLED" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStatusChange(task.id, "CANCELLED")}
            disabled={actionLoading}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Meta */}
      <dl className="space-y-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-muted-foreground">Assigned to</dt>
          <dd>
            {task.assignedTo
              ? (task.assignedTo.name ?? task.assignedTo.email)
              : <span className="text-muted-foreground">Unassigned</span>}
          </dd>
        </div>

        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-muted-foreground">Customer</dt>
          <dd>
            {task.linkedCustomer ? (
              <Link
                href={`/admin/customers/${task.linkedCustomer.id}`}
                className="underline underline-offset-4"
              >
                {task.linkedCustomer.name ?? task.linkedCustomer.email}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>

        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-muted-foreground">Due date</dt>
          <dd className={overdue ? "font-medium text-destructive" : ""}>
            {task.dueAt
              ? formatMountainTime(new Date(task.dueAt), "datetime")
              : <span className="text-muted-foreground">—</span>}
          </dd>
        </div>

        {task.completedAt && (
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 font-medium text-muted-foreground">Completed</dt>
            <dd>{formatMountainTime(new Date(task.completedAt), "datetime")}</dd>
          </div>
        )}

        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-muted-foreground">Created by</dt>
          <dd>{task.createdBy.name ?? task.createdBy.email}</dd>
        </div>

        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-muted-foreground">Created</dt>
          <dd>{formatMountainTime(new Date(task.createdAt), "datetime")}</dd>
        </div>
      </dl>
    </div>
  );
}
