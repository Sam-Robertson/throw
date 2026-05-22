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

interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  billingIntervalDays: number;
  stripePriceId: string | null;
  locationId: string | null;
  isActive: boolean;
  _count: { memberships: number };
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  priceInCents: string;
  billingIntervalDays: string;
  stripePriceId: string;
  locationId: string;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  priceInCents: "",
  billingIntervalDays: "30",
  stripePriceId: "",
  locationId: "",
};

function formatPrice(priceInCents: number, billingIntervalDays: number): string {
  const dollars = (priceInCents / 100).toFixed(2);
  if (billingIntervalDays <= 35) return `$${dollars}/mo`;
  if (billingIntervalDays <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/membership-plans");
    if (res.ok) setPlans(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(plan: MembershipPlan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? "",
      priceInCents: String(plan.price),
      billingIntervalDays: String(plan.billingIntervalDays),
      stripePriceId: plan.stripePriceId ?? "",
      locationId: plan.locationId ?? "",
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
      slug: form.slug,
      description: form.description || null,
      priceInCents: parseInt(form.priceInCents, 10),
      billingIntervalDays: parseInt(form.billingIntervalDays, 10),
      stripePriceId: form.stripePriceId || null,
      locationId: form.locationId || null,
    };

    const res = editingId
      ? await fetch(`/api/admin/membership-plans/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/membership-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleToggle(plan: MembershipPlan) {
    await fetch(`/api/admin/membership-plans/${plan.id}/toggle`, { method: "PATCH" });
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
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Membership Plans</h1>
        <Button onClick={openNew}>New Plan</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Active Members</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stripe Price ID</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="font-medium">{plan.name}</TableCell>
              <TableCell>{formatPrice(plan.price, plan.billingIntervalDays)}</TableCell>
              <TableCell>{plan._count.memberships}</TableCell>
              <TableCell>
                <Badge variant={plan.isActive ? "default" : "secondary"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {plan.stripePriceId
                  ? plan.stripePriceId.length > 12
                    ? `${plan.stripePriceId.slice(0, 12)}...`
                    : plan.stripePriceId
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={plan.isActive ? "secondary" : "outline"}
                    onClick={() => handleToggle(plan)}
                  >
                    {plan.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {plans.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No membership plans yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price (cents)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={form.priceInCents}
                  onChange={(e) => setForm({ ...form, priceInCents: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interval">Billing Interval (days)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  value={form.billingIntervalDays}
                  onChange={(e) => setForm({ ...form, billingIntervalDays: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stripePriceId">Stripe Price ID</Label>
              <Input
                id="stripePriceId"
                value={form.stripePriceId}
                onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
                placeholder="price_..."
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
