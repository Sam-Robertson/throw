'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

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
  classTicketsPerPeriod: number | null;
  ticketRolloverEnabled: boolean;
  ticketRolloverMaxTickets: number | null;
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
  classTicketsPerPeriod: string;
  ticketRolloverEnabled: boolean;
  ticketRolloverMaxTickets: string;
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  description: '',
  priceInCents: '',
  billingIntervalDays: '30',
  stripePriceId: '',
  locationId: '',
  classTicketsPerPeriod: '',
  ticketRolloverEnabled: false,
  ticketRolloverMaxTickets: '',
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
    const res = await fetch('/api/admin/membership-plans');
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
      description: plan.description ?? '',
      priceInCents: String(plan.price),
      billingIntervalDays: String(plan.billingIntervalDays),
      stripePriceId: plan.stripePriceId ?? '',
      locationId: plan.locationId ?? '',
      classTicketsPerPeriod:
        plan.classTicketsPerPeriod === null ? '' : String(plan.classTicketsPerPeriod),
      ticketRolloverEnabled: plan.ticketRolloverEnabled,
      ticketRolloverMaxTickets:
        plan.ticketRolloverMaxTickets === null ? '' : String(plan.ticketRolloverMaxTickets),
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
      classTicketsPerPeriod:
        form.classTicketsPerPeriod.trim() === '' ? null : parseInt(form.classTicketsPerPeriod, 10),
      ticketRolloverEnabled: form.ticketRolloverEnabled,
      ticketRolloverMaxTickets:
        form.ticketRolloverMaxTickets.trim() === ''
          ? null
          : parseInt(form.ticketRolloverMaxTickets, 10),
    };

    const res = editingId
      ? await fetch(`/api/admin/membership-plans/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/admin/membership-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? 'Something went wrong');
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleToggle(plan: MembershipPlan) {
    await fetch(`/api/admin/membership-plans/${plan.id}/toggle`, { method: 'PATCH' });
    await load();
  }

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Subscriptions & Packs
        </Typography>
        <Button variant="contained" onClick={openNew}>
          New Plan
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Class Tickets</TableCell>
              <TableCell>Active Members</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Stripe Price ID</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell sx={{ fontWeight: 600 }}>{plan.name}</TableCell>
                <TableCell>{formatPrice(plan.price, plan.billingIntervalDays)}</TableCell>
                <TableCell>
                  {plan.classTicketsPerPeriod === null ? (
                    'Unlimited'
                  ) : (
                    <>
                      {plan.classTicketsPerPeriod}/period
                      {plan.ticketRolloverEnabled && (
                        <Chip
                          label={
                            plan.ticketRolloverMaxTickets !== null
                              ? `Rollover ≤${plan.ticketRolloverMaxTickets}`
                              : 'Rollover'
                          }
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>{plan._count.memberships}</TableCell>
                <TableCell>
                  <Chip
                    label={plan.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={plan.isActive ? 'success' : 'default'}
                    variant={plan.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                  >
                    {plan.stripePriceId
                      ? plan.stripePriceId.length > 12
                        ? `${plan.stripePriceId.slice(0, 12)}…`
                        : plan.stripePriceId
                      : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button size="small" variant="outlined" onClick={() => openEdit(plan)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant={plan.isActive ? 'outlined' : 'contained'}
                      color={plan.isActive ? 'error' : 'primary'}
                      onClick={() => handleToggle(plan)}
                    >
                      {plan.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No membership plans yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Plan' : 'New Plan'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="plan-form" onSubmit={handleSubmit}>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                  />
                </Grid>
              </Grid>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                rows={2}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Price (cents)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.priceInCents}
                    onChange={(e) => setForm({ ...form, priceInCents: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Billing Interval (days)"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.billingIntervalDays}
                    onChange={(e) => setForm({ ...form, billingIntervalDays: e.target.value })}
                    required
                  />
                </Grid>
              </Grid>
              <TextField
                label="Stripe Price ID"
                value={form.stripePriceId}
                onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
                placeholder="price_..."
              />

              <TextField
                label="Class tickets per period"
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                value={form.classTicketsPerPeriod}
                onChange={(e) => setForm({ ...form, classTicketsPerPeriod: e.target.value })}
                helperText="Empty means unlimited classes"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={form.ticketRolloverEnabled}
                    onChange={(e) =>
                      setForm({ ...form, ticketRolloverEnabled: e.target.checked })
                    }
                  />
                }
                label="Allow unused tickets to roll over to the next period"
              />

              {form.ticketRolloverEnabled && (
                <TextField
                  label="Rollover cap"
                  type="number"
                  slotProps={{ htmlInput: { min: 0 } }}
                  value={form.ticketRolloverMaxTickets}
                  onChange={(e) =>
                    setForm({ ...form, ticketRolloverMaxTickets: e.target.value })
                  }
                  helperText="Empty means no cap on carried-over tickets"
                />
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
