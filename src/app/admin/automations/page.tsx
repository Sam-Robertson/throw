"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TRIGGER_EVENTS = [
  "booking/confirmed",
  "booking/reminder",
  "booking/cancelled",
  "membership/created",
  "membership/paused",
] as const;

interface SmsAutomation {
  id: string;
  name: string;
  triggerEvent: string;
  delayMinutes: number;
  messageTemplate: string;
  isActive: boolean;
}

interface SmsLog {
  id: string;
  toPhone: string;
  message: string;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

interface FormState {
  name: string;
  triggerEvent: string;
  delayMinutes: string;
  messageTemplate: string;
}

const emptyForm: FormState = {
  name: "",
  triggerEvent: "booking/confirmed",
  delayMinutes: "0",
  messageTemplate: "",
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return `****${phone.slice(-4)}`;
}

export default function AdminAutomationsPage() {
  const [automations, setAutomations] = useState<SmsAutomation[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [autoRes, logRes] = await Promise.all([
      fetch("/api/admin/automations"),
      fetch("/api/admin/sms-log"),
    ]);
    if (autoRes.ok) setAutomations(await autoRes.json());
    if (logRes.ok) setLogs((await logRes.json()).slice(0, 50));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(a: SmsAutomation) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      triggerEvent: a.triggerEvent,
      delayMinutes: String(a.delayMinutes),
      messageTemplate: a.messageTemplate,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      triggerEvent: form.triggerEvent,
      delayMinutes: parseInt(form.delayMinutes, 10) || 0,
      messageTemplate: form.messageTemplate,
    };

    const res = editingId
      ? await fetch(`/api/admin/automations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Something went wrong");
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleToggle(id: string) {
    await fetch(`/api/admin/automations/${id}/toggle`, { method: "PATCH" });
    await load();
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-10">
      {/* Automations list */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">SMS Automations</h1>
          <Button onClick={openNew}>New Automation</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {a.triggerEvent}
                  </code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.delayMinutes > 0 ? `${a.delayMinutes} min` : "immediate"}
                </TableCell>
                <TableCell>
                  <Badge variant={a.isActive ? "default" : "secondary"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="line-clamp-1">
                    {a.messageTemplate.slice(0, 80)}
                    {a.messageTemplate.length > 80 ? "…" : ""}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={a.isActive ? "secondary" : "outline"}
                      onClick={() => handleToggle(a.id)}
                    >
                      {a.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {automations.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No automations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Recent SMS Log */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent SMS Log</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Message preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-sm">
                  {maskPhone(log.toPhone)}
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="line-clamp-1">
                    {log.message.slice(0, 80)}
                    {log.message.length > 80 ? "…" : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      log.status === "sent"
                        ? "default"
                        : log.status === "skipped"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-muted-foreground"
                >
                  No messages sent yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Automation" : "New Automation"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="trigger">Trigger event</Label>
                <select
                  id="trigger"
                  value={form.triggerEvent}
                  onChange={(e) =>
                    setForm({ ...form, triggerEvent: e.target.value })
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  required
                >
                  {TRIGGER_EVENTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delay">Delay (minutes)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  value={form.delayMinutes}
                  onChange={(e) =>
                    setForm({ ...form, delayMinutes: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template">Message template</Label>
              <Textarea
                id="template"
                value={form.messageTemplate}
                onChange={(e) =>
                  setForm({ ...form, messageTemplate: e.target.value })
                }
                rows={5}
                placeholder={
                  "Hi {{name}}, your {{session_type}} is confirmed for {{date}} at {{time}}."
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Variables: {"{{name}}"}, {"{{session_type}}"}, {"{{date}}"},{" "}
                {"{{time}}"}, {"{{location}}"}, {"{{plan_name}}"}
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
