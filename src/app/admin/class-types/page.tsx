"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SessionType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  capacity: number;
  dropInPriceCents: number;
  isBusyWindow: boolean;
  isActive: boolean;
  _count: { studioSessions: number };
}

interface FormState {
  name: string;
  description: string;
  durationMinutes: string;
  capacity: string;
  dropInPriceDollars: string;
  isBusyWindow: boolean;
  isActive: boolean;
}

const defaultForm: FormState = {
  name: "",
  description: "",
  durationMinutes: "90",
  capacity: "12",
  dropInPriceDollars: "20.00",
  isBusyWindow: false,
  isActive: true,
};

function toForm(st: SessionType): FormState {
  return {
    name: st.name,
    description: st.description ?? "",
    durationMinutes: String(st.durationMinutes),
    capacity: String(st.capacity),
    dropInPriceDollars: (st.dropInPriceCents / 100).toFixed(2),
    isBusyWindow: st.isBusyWindow,
    isActive: st.isActive,
  };
}

export default function ClassTypesPage() {
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionType | null>(null);
  const [editTarget, setEditTarget] = useState<SessionType | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/session-types")
      .then((r) => r.json())
      .then(setSessionTypes)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(st: SessionType) {
    setEditTarget(st);
    setForm(toForm(st));
    setFormError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      durationMinutes: Number(form.durationMinutes),
      capacity: Number(form.capacity),
      dropInPriceCents: Math.round(parseFloat(form.dropInPriceDollars) * 100),
      isBusyWindow: form.isBusyWindow,
      isActive: form.isActive,
    };

    if (!payload.name) {
      setFormError("Name is required");
      setSaving(false);
      return;
    }

    const isEdit = editTarget !== null;
    const url = isEdit
      ? `/api/admin/session-types/${editTarget.id}`
      : "/api/admin/session-types";
    const method = isEdit ? "PATCH" : "POST";

    // Optimistic update for edits
    const prevList = sessionTypes;
    if (isEdit) {
      setSessionTypes((prev) =>
        prev.map((st) =>
          st.id === editTarget.id
            ? { ...st, ...payload, _count: st._count }
            : st,
        ),
      );
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (isEdit) setSessionTypes(prevList);
      const data = await res.json().catch(() => ({})) as { error?: string };
      setFormError(data.error ?? "Save failed");
      setSaving(false);
      return;
    }

    const saved = (await res.json()) as SessionType;
    if (isEdit) {
      setSessionTypes((prev) =>
        prev.map((st) => (st.id === saved.id ? saved : st)),
      );
    } else {
      setSessionTypes((prev) => [...prev, saved]);
    }

    setDialogOpen(false);
    setSaving(false);
  }

  async function handleDelete(st: SessionType) {
    const prevList = sessionTypes;
    setSessionTypes((prev) => prev.filter((s) => s.id !== st.id));
    setDeleteTarget(null);

    const res = await fetch(`/api/admin/session-types/${st.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setSessionTypes(prevList);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Class Types</h1>
          <Button onClick={openCreate}>New class type</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Drop-in price</TableHead>
                <TableHead>Busy window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Upcoming</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionTypes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No class types yet
                  </TableCell>
                </TableRow>
              ) : (
                sessionTypes.map((st) => (
                  <TableRow
                    key={st.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(st)}
                  >
                    <TableCell className="font-medium">{st.name}</TableCell>
                    <TableCell>{st.durationMinutes} min</TableCell>
                    <TableCell>{st.capacity}</TableCell>
                    <TableCell>
                      ${(st.dropInPriceCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {st.isBusyWindow ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {st.isActive ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>{st._count.studioSessions}</TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="text-right"
                    >
                      {st._count.studioSessions > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="text-destructive"
                              >
                                Delete
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {st._count.studioSessions} upcoming session
                            {st._count.studioSessions === 1 ? "" : "s"} — cannot
                            delete
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(st)}
                        >
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Create / Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editTarget ? "Edit class type" : "New class type"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <div className="space-y-1">
                <Label htmlFor="ct-name">Name</Label>
                <Input
                  id="ct-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ct-desc">Description</Label>
                <Textarea
                  id="ct-desc"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ct-duration">Duration (min)</Label>
                  <Input
                    id="ct-duration"
                    type="number"
                    min={15}
                    value={form.durationMinutes}
                    onChange={(e) => setField("durationMinutes", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ct-capacity">Capacity</Label>
                  <Input
                    id="ct-capacity"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setField("capacity", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ct-price">Drop-in price ($)</Label>
                <Input
                  id="ct-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.dropInPriceDollars}
                  onChange={(e) => setField("dropInPriceDollars", e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ct-busy">Requires member credit (busy window)</Label>
                <Switch
                  id="ct-busy"
                  checked={form.isBusyWindow}
                  onCheckedChange={(v) => setField("isBusyWindow", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ct-active">Active</Label>
                <Switch
                  id="ct-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setField("isActive", v)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
