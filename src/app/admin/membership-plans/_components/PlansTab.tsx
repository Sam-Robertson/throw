'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
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
import { billingPeriodLabel } from '@/lib/billingInterval';
import { useLocationFilter, withLocationParam, ALL_LOCATIONS } from '../../_components/LocationFilterContext';
import { centsToDollars, dollarsToCents, formatMoney, sendJson, slugify, toWholeNumber } from './shared';

interface CapGroupOption {
  id: string;
  name: string;
  cap: number;
  locationId: string | null;
}

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
  shelfType: string | null;
  joiningFeeCents: number;
  perks: unknown;
  tier: string | null;
  isPublic: boolean;
  isLegacy: boolean;
  isFounding: boolean;
  capGroupId: string | null;
  forfeitsRateOnCancelOrFreeze: boolean;
  priceNeedsConfirmation: boolean;
  archivedAt: string | null;
  location: { id: string; name: string } | null;
  capGroup: { id: string; name: string; cap: number; sold: number } | null;
  _count: { memberships: number };
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  priceDollars: string;
  billingIntervalDays: string;
  locationId: string;
  classTicketsPerPeriod: string;
  ticketRolloverEnabled: boolean;
  ticketRolloverMaxTickets: string;
  shelfType: string;
  joiningFeeDollars: string;
  perks: string;
  tier: string;
  isPublic: boolean;
  isLegacy: boolean;
  isFounding: boolean;
  capGroupId: string;
  forfeitsRateOnCancelOrFreeze: boolean;
  priceNeedsConfirmation: boolean;
}

const TIERS = ['BASIC', 'PRO', 'EXPERT', 'STUDENT'];
const SHELF_TYPES = [
  { value: '', label: 'No shelf' },
  { value: 'HALF', label: 'Half shelf' },
  { value: 'FULL', label: 'Full shelf' },
];

function emptyForm(locationId: string): FormState {
  return {
    name: '',
    slug: '',
    description: '',
    priceDollars: '',
    billingIntervalDays: '',
    locationId,
    classTicketsPerPeriod: '',
    ticketRolloverEnabled: false,
    ticketRolloverMaxTickets: '',
    shelfType: '',
    joiningFeeDollars: '',
    perks: '',
    tier: '',
    isPublic: false,
    isLegacy: false,
    isFounding: false,
    capGroupId: '',
    forfeitsRateOnCancelOrFreeze: false,
    priceNeedsConfirmation: false,
  };
}

function toForm(plan: MembershipPlan): FormState {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? '',
    priceDollars: centsToDollars(plan.price),
    billingIntervalDays: String(plan.billingIntervalDays),
    locationId: plan.locationId ?? '',
    classTicketsPerPeriod:
      plan.classTicketsPerPeriod === null ? '' : String(plan.classTicketsPerPeriod),
    ticketRolloverEnabled: plan.ticketRolloverEnabled,
    ticketRolloverMaxTickets:
      plan.ticketRolloverMaxTickets === null ? '' : String(plan.ticketRolloverMaxTickets),
    shelfType: plan.shelfType ?? '',
    joiningFeeDollars: centsToDollars(plan.joiningFeeCents),
    perks: Array.isArray(plan.perks) ? (plan.perks as string[]).join('\n') : '',
    tier: plan.tier ?? '',
    isPublic: plan.isPublic,
    isLegacy: plan.isLegacy,
    isFounding: plan.isFounding,
    capGroupId: plan.capGroupId ?? '',
    forfeitsRateOnCancelOrFreeze: plan.forfeitsRateOnCancelOrFreeze,
    priceNeedsConfirmation: plan.priceNeedsConfirmation,
  };
}

function formatPrice(plan: MembershipPlan): string {
  return `${formatMoney(plan.price)} / ${billingPeriodLabel(plan.billingIntervalDays)}`;
}

// The imported Momence plans: legacy rows that are switched off. They are
// history (members still point at them), not something staff work with.
function isLegacyImport(plan: MembershipPlan): boolean {
  return plan.isLegacy && !plan.isActive;
}

export default function PlansTab() {
  const { locations, selectedLocationId } = useLocationFilter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [capGroups, setCapGroups] = useState<CapGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [plansRes, groupsRes] = await Promise.all([
      fetch(withLocationParam('/api/admin/membership-plans', selectedLocationId)),
      fetch(withLocationParam('/api/admin/membership-catalog/cap-groups', selectedLocationId)),
    ]);
    if (plansRes.ok) setPlans(await plansRes.json());
    if (groupsRes.ok) setCapGroups(await groupsRes.json());
    setLoading(false);
  }, [selectedLocationId]);

  useEffect(() => {
    load();
  }, [load]);

  const hiddenCount = plans.filter((p) => p.archivedAt !== null || isLegacyImport(p)).length;
  const visible = showHidden
    ? plans
    : plans.filter((p) => p.archivedAt === null && !isLegacyImport(p));

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm(selectedLocationId === ALL_LOCATIONS ? (locations[0]?.id ?? '') : selectedLocationId));
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(plan: MembershipPlan) {
    setEditing(plan);
    setForm(toForm(plan));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceInCents = dollarsToCents(form.priceDollars);
    const joiningFeeCents = dollarsToCents(form.joiningFeeDollars) ?? 0;
    const billingIntervalDays = toWholeNumber(form.billingIntervalDays);
    const classTicketsPerPeriod = toWholeNumber(form.classTicketsPerPeriod);
    const ticketRolloverMaxTickets = toWholeNumber(form.ticketRolloverMaxTickets);
    if (
      priceInCents === null ||
      !billingIntervalDays ||
      [priceInCents, joiningFeeCents, billingIntervalDays, classTicketsPerPeriod, ticketRolloverMaxTickets].some(
        (n) => Number.isNaN(n),
      )
    ) {
      setError('Check the numbers: price and billing interval are required, and amounts can’t be negative.');
      return;
    }
    // Imported plans have no studio and may stay that way; new plans need one.
    const studioOptional = editing !== null && editing.locationId === null;
    if (!form.locationId && !studioOptional) {
      setError('Choose a studio.');
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description || null,
      priceInCents,
      billingIntervalDays,
      locationId: form.locationId || null,
      classTicketsPerPeriod,
      ticketRolloverEnabled: form.ticketRolloverEnabled,
      ticketRolloverMaxTickets: form.ticketRolloverEnabled ? ticketRolloverMaxTickets : null,
      shelfType: form.shelfType || null,
      joiningFeeCents,
      perks: form.perks.split('\n'),
      tier: form.tier || null,
      isPublic: form.isPublic,
      isLegacy: form.isLegacy,
      isFounding: form.isFounding,
      capGroupId: form.capGroupId || null,
      forfeitsRateOnCancelOrFreeze: form.forfeitsRateOnCancelOrFreeze,
      priceNeedsConfirmation: form.priceNeedsConfirmation,
    };

    setSaving(true);
    try {
      const saved = await sendJson<{ stripeWarning: string | null }>(
        editing ? `/api/admin/membership-plans/${editing.id}` : '/api/admin/membership-plans',
        editing ? 'PATCH' : 'POST',
        payload,
      );
      setNotice(saved.stripeWarning);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setSaving(false);
  }

  async function handleToggle(plan: MembershipPlan) {
    await fetch(`/api/admin/membership-plans/${plan.id}/toggle`, { method: 'PATCH' });
    await load();
  }

  async function handleArchive(plan: MembershipPlan, archived: boolean) {
    await sendJson(`/api/admin/membership-plans/${plan.id}/archive`, 'PATCH', { archived }).catch(() => null);
    await load();
  }

  if (loading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  const groupOptions = capGroups.filter((g) => g.locationId === null || g.locationId === form.locationId);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Switch checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />}
          label={`Show archived and imported plans (${hiddenCount})`}
        />
        <Button variant="contained" onClick={openNew}>
          New Plan
        </Button>
      </Box>

      {notice && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Studio</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Class Tickets</TableCell>
              <TableCell>Active Members</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((plan) => (
              <TableRow key={plan.id} sx={plan.archivedAt ? { opacity: 0.6 } : undefined}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{plan.name}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                    {plan.isFounding && <Chip label="Founding" size="small" color="secondary" />}
                    {plan.isLegacy && <Chip label="Legacy" size="small" variant="outlined" />}
                    {plan.priceNeedsConfirmation && (
                      <Chip label="Needs confirmation" size="small" color="warning" />
                    )}
                    {plan.archivedAt && <Chip label="Archived" size="small" />}
                    {!plan.isPublic && !plan.isLegacy && !plan.archivedAt && (
                      <Chip label="Not public" size="small" variant="outlined" />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  {locations.find((l) => l.id === plan.locationId)?.shortName ?? plan.location?.name ?? '—'}
                </TableCell>
                <TableCell>{formatPrice(plan)}</TableCell>
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
                <TableCell>
                  {plan._count.memberships}
                  {plan.capGroup && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {plan.capGroup.name}: {plan.capGroup.sold} / {plan.capGroup.cap}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={plan.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={plan.isActive ? 'success' : 'default'}
                    variant={plan.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button size="small" variant="outlined" onClick={() => openEdit(plan)}>
                      Edit
                    </Button>
                    {plan.archivedAt ? (
                      <Button size="small" variant="outlined" onClick={() => handleArchive(plan, false)}>
                        Restore
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant={plan.isActive ? 'outlined' : 'contained'}
                          color={plan.isActive ? 'error' : 'primary'}
                          onClick={() => handleToggle(plan)}
                        >
                          {plan.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => handleArchive(plan, true)}>
                          Archive
                        </Button>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No membership plans to show.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Plan' : 'New Plan'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="plan-form" onSubmit={handleSubmit}>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    helperText={editing ? undefined : 'Empty: made from the name'}
                  />
                </Grid>
              </Grid>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                multiline
                rows={2}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Studio"
                    value={form.locationId}
                    onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value, capGroupId: '' }))}
                    required={!(editing !== null && editing.locationId === null)}
                  >
                    {locations.map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.shortName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField select label="Tier" value={form.tier} onChange={(e) => setField('tier', e.target.value)}>
                    <MenuItem value="">None</MenuItem>
                    {TIERS.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Price ($)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                    value={form.priceDollars}
                    onChange={(e) => setField('priceDollars', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Billing interval (days)"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.billingIntervalDays}
                    onChange={(e) => setField('billingIntervalDays', e.target.value)}
                    helperText={
                      form.billingIntervalDays && Number(form.billingIntervalDays) > 0
                        ? `Bills every ${billingPeriodLabel(Number(form.billingIntervalDays))}`
                        : undefined
                    }
                    required
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Joining fee ($)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                    value={form.joiningFeeDollars}
                    onChange={(e) => setField('joiningFeeDollars', e.target.value)}
                    helperText="Used when no commitment term applies"
                  />
                </Grid>
              </Grid>
              {editing && editing._count.memberships > 0 && (
                <Typography variant="caption" color="text.secondary">
                  This plan has active members, so its price and interval can’t change. Archive it and
                  create a new plan instead.
                </Typography>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={form.priceNeedsConfirmation}
                    onChange={(e) => setField('priceNeedsConfirmation', e.target.checked)}
                  />
                }
                label="Price still needs confirmation from the client"
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Class tickets per period"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.classTicketsPerPeriod}
                    onChange={(e) => setField('classTicketsPerPeriod', e.target.value)}
                    helperText="Empty means UNLIMITED classes. Use 0 for none."
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Shelf"
                    value={form.shelfType}
                    onChange={(e) => setField('shelfType', e.target.value)}
                  >
                    {SHELF_TYPES.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={form.ticketRolloverEnabled}
                    onChange={(e) => setField('ticketRolloverEnabled', e.target.checked)}
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
                  onChange={(e) => setField('ticketRolloverMaxTickets', e.target.value)}
                  helperText="Empty means no cap on carried-over tickets"
                />
              )}

              <TextField
                label="Perks"
                value={form.perks}
                onChange={(e) => setField('perks', e.target.value)}
                multiline
                rows={3}
                helperText="One per line. Shown on the public membership page."
              />

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isPublic}
                      onChange={(e) => setField('isPublic', e.target.checked)}
                      disabled={form.isLegacy}
                    />
                  }
                  label="Public: shown on the website and sold online"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isLegacy}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          isLegacy: e.target.checked,
                          isPublic: e.target.checked ? false : prev.isPublic,
                        }))
                      }
                    />
                  }
                  label="Legacy: never sold, only assigned by staff"
                />
                <FormControlLabel
                  control={
                    <Switch checked={form.isFounding} onChange={(e) => setField('isFounding', e.target.checked)} />
                  }
                  label="Founding plan"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.forfeitsRateOnCancelOrFreeze}
                      onChange={(e) => setField('forfeitsRateOnCancelOrFreeze', e.target.checked)}
                    />
                  }
                  label="Rate is lost on cancel or freeze"
                />
              </Box>

              <TextField
                select
                label="Cap group"
                value={form.capGroupId}
                onChange={(e) => setField('capGroupId', e.target.value)}
                helperText="Plans in one group share a limit on how many can be sold"
              >
                <MenuItem value="">None</MenuItem>
                {groupOptions.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name} (cap {g.cap})
                  </MenuItem>
                ))}
              </TextField>

              {editing && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  Stripe price: {editing.stripePriceId ?? 'created at the first checkout'}
                </Typography>
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
