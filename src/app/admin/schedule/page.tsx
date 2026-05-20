"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDIO_TIMEZONE } from "@/lib/timezone";

interface StudioSession {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isCancelled: boolean;
  sessionType: { name: string; durationMinutes: number; capacity: number };
  instructor: { id: string; name: string | null } | null;
  _count: { bookings: number };
}

interface SessionTypeOption {
  id: string;
  name: string;
  durationMinutes: number;
  capacity: number;
  isActive: boolean;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

const NONE = "__none__";

function getWeekDays(offset: number): Date[] {
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const weekStart = startOfWeek(addWeeks(nowMT, offset), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function sessionDayKey(session: StudioSession): string {
  return formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, "yyyy-MM-dd");
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionTypeOption[]>([]);
  const [instructors, setInstructors] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Add session dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState<string>("");
  const [addForm, setAddForm] = useState({
    sessionTypeId: "",
    localDate: "",
    localTime: "09:00",
    instructorId: NONE,
    capacityOverride: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit session dialog
  const [editSession, setEditSession] = useState<StudioSession | null>(null);
  const [editForm, setEditForm] = useState({
    instructorId: NONE,
    capacity: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const weekDays = getWeekDays(weekOffset);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    const fromUTC = fromZonedTime(
      `${dayKey(weekDays[0])}T00:00:00`,
      STUDIO_TIMEZONE,
    );
    const toUTC = fromZonedTime(
      `${dayKey(addDays(weekDays[0], 7))}T00:00:00`,
      STUDIO_TIMEZONE,
    );
    fetch(
      `/api/admin/studio-sessions?from=${fromUTC.toISOString()}&to=${toUTC.toISOString()}`,
    )
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  // weekDays changes every render but weekOffset is the real dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetch("/api/admin/session-types")
      .then((r) => r.json())
      .then((data: SessionTypeOption[]) =>
        setSessionTypes(data.filter((st) => st.isActive)),
      );
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setInstructors);
  }, []);

  const weekLabel = `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`;

  function openAdd(defaultDate?: string) {
    setAddDefaultDate(defaultDate ?? "");
    setAddForm({
      sessionTypeId: sessionTypes[0]?.id ?? "",
      localDate: defaultDate ?? dayKey(weekDays[0]),
      localTime: "09:00",
      instructorId: NONE,
      capacityOverride: "",
    });
    setAddError(null);
    setAddOpen(true);
  }

  function openEdit(session: StudioSession) {
    setEditSession(session);
    setEditForm({
      instructorId: session.instructor?.id ?? NONE,
      capacity: String(session.capacity),
    });
    setEditError(null);
  }

  async function handleAddSave() {
    setAddSaving(true);
    setAddError(null);

    const res = await fetch("/api/admin/studio-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionTypeId: addForm.sessionTypeId,
        localDate: addForm.localDate,
        localTime: addForm.localTime,
        instructorId: addForm.instructorId === NONE ? null : addForm.instructorId,
        capacityOverride: addForm.capacityOverride
          ? Number(addForm.capacityOverride)
          : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setAddError(data.error ?? "Failed to create session");
      setAddSaving(false);
      return;
    }

    const created = (await res.json()) as StudioSession;
    setSessions((prev) => [...prev, created]);
    setAddOpen(false);
    setAddSaving(false);
  }

  async function handleEditSave() {
    if (!editSession) return;
    setEditSaving(true);
    setEditError(null);

    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instructorId:
          editForm.instructorId === NONE ? null : editForm.instructorId,
        capacity: Number(editForm.capacity),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setEditError(data.error ?? "Save failed");
      setEditSaving(false);
      return;
    }

    const updated = (await res.json()) as StudioSession;
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
    setEditSession(null);
    setEditSaving(false);
  }

  async function handleCancelSession() {
    if (!editSession) return;
    setCancelConfirmOpen(false);

    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCancelled: true }),
    });

    if (res.ok) {
      const updated = (await res.json()) as StudioSession;
      setSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      setEditSession(null);
    }
  }

  return (
    <div className="flex flex-col p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              ‹
            </Button>
            <span className="min-w-48 text-center text-sm">{weekLabel}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              ›
            </Button>
            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
              >
                Today
              </Button>
            )}
          </div>
        </div>
        <Button onClick={() => openAdd()}>Add session</Button>
      </div>

      {/* Week grid */}
      <div className="grid flex-1 grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const key = dayKey(day);
          const daySessions = sessions
            .filter((s) => sessionDayKey(s) === key)
            .sort(
              (a, b) =>
                new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            );

          return (
            <div key={key} className="flex flex-col gap-1">
              {/* Column header */}
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {format(day, "EEE M/d")}
                </span>
                <button
                  onClick={() => openAdd(key)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title="Add session"
                >
                  +
                </button>
              </div>

              {/* Session cards */}
              {loading ? (
                <div className="h-16 animate-pulse rounded-md bg-muted" />
              ) : (
                daySessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => openEdit(session)}
                    className={`w-full rounded-md border p-2 text-left text-xs transition-colors hover:bg-accent ${
                      session.isCancelled ? "opacity-50" : ""
                    }`}
                  >
                    <p className="font-medium leading-tight">
                      {session.sessionType.name}
                    </p>
                    <p className="text-muted-foreground">
                      {formatInTimeZone(
                        new Date(session.startsAt),
                        STUDIO_TIMEZONE,
                        "h:mm a",
                      )}
                    </p>
                    {session.instructor?.name && (
                      <p className="text-muted-foreground">
                        {session.instructor.name}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      {session._count.bookings}/{session.capacity}
                    </p>
                    {session.isCancelled && (
                      <Badge variant="destructive" className="mt-0.5 text-[10px]">
                        Cancelled
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Add session dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && <p className="text-sm text-destructive">{addError}</p>}

            <div className="space-y-1">
              <Label>Class type</Label>
              <Select
                value={addForm.sessionTypeId}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, sessionTypeId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class type" />
                </SelectTrigger>
                <SelectContent>
                  {sessionTypes.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="add-date">Date (MT)</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addForm.localDate}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, localDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-time">Start time (MT)</Label>
                <Input
                  id="add-time"
                  type="time"
                  value={addForm.localTime}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, localTime: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Instructor</Label>
              <Select
                value={addForm.instructorId}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, instructorId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {instructors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-cap">Capacity override</Label>
              <Input
                id="add-cap"
                type="number"
                min={1}
                placeholder="Leave blank to use class type default"
                value={addForm.capacityOverride}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, capacityOverride: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSave} disabled={addSaving}>
              {addSaving ? "Saving…" : "Add session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit session dialog */}
      <Dialog
        open={editSession !== null}
        onOpenChange={(open) => !open && setEditSession(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editSession?.sessionType.name}
              {editSession?.isCancelled && (
                <Badge variant="destructive" className="ml-2">
                  Cancelled
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {editSession && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {formatInTimeZone(
                  new Date(editSession.startsAt),
                  STUDIO_TIMEZONE,
                  "EEE, MMM d 'at' h:mm a",
                )}{" "}
                MT
              </p>

              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}

              {!editSession.isCancelled && (
                <>
                  <div className="space-y-1">
                    <Label>Instructor</Label>
                    <Select
                      value={editForm.instructorId}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, instructorId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {instructors.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-cap">Capacity</Label>
                    <Input
                      id="edit-cap"
                      type="number"
                      min={1}
                      value={editForm.capacity}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, capacity: e.target.value }))
                      }
                    />
                  </div>
                </>
              )}

              <p className="text-sm text-muted-foreground">
                {editSession._count.bookings} booking
                {editSession._count.bookings === 1 ? "" : "s"} /{" "}
                {editSession.capacity} capacity
              </p>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editSession && !editSession.isCancelled && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={() => setCancelConfirmOpen(true)}
              >
                Cancel session
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditSession(null)}>
              Close
            </Button>
            {editSession && !editSession.isCancelled && (
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel session confirmation */}
      <AlertDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel all confirmed bookings for this session. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep session</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelSession}
            >
              Yes, cancel session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
