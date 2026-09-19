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
import { useLocationFilter, withLocationParam } from '../../_components/LocationFilterContext';
import { centsToDollars, dollarsToCents, formatMoney, sendJson, slugify, toWholeNumber } from './shared';

interface AddOn {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  billingIntervalDays: number;
  locationId: string | null;
  isActive: boolean;
  archivedAt: string | null;
  _count: { assignments: number };
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  priceDollars: string;
  billingIntervalDays: string;
  locationId: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  description: '',
  priceDollars: '',
  billingIntervalDays: '',
  locationId: '',
  isActive: true,
};

function toForm(addOn: AddOn): FormState {
  return {
    name: addOn.name,
    slug: addOn.slug,
    description: addOn.description ?? '',
    priceDollars: centsToDollars(addOn.priceCents),
    billingIntervalDays: String(addOn.billingIntervalDays),
    locationId: addOn.locationId ?? '',
    isActive: addOn.isActive,
  };
}

export default function AddOnsTab() {
  const { locations, selectedLocationId } = useLocationFilter();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(withLocationParam('/api/admin/membership-catalog/add-ons', selectedLocationId));
    if (res.ok) setAddOns(await res.json());
    setLoading(false);
  }, [selectedLocationId]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function open(addOn: AddOn | null) {
    setEditing(addOn);
    setForm(addOn ? toForm(addOn) : emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCents = dollarsToCents(form.priceDollars);
    const billingIntervalDays = toWholeNumber(form.billingIntervalDays);
    if (Number.isNaN(priceCents) || !billingIntervalDays || Number.isNaN(billingIntervalDays)) {
      setError('Check the numbers: the billing interval is required, and the price can’t be negative.');
      return;
    }

    setSaving(true);
    try {
      await sendJson(
        editing ? `/api/admin/membership-catalog/add-ons/${editing.id}` : '/api/admin/membership-catalog/add-ons',
        editing ? 'PATCH' : 'POST',
        {
          name: form.name,
          slug: form.slug || slugify(form.name),
          description: form.description || null,
          priceCents,
          billingIntervalDays,
          locationId: form.locationId || null,
          isActive: form.isActive,
        },
      );
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setSaving(false);
  }

  async function handleArchive(addOn: AddOn, archived: boolean) {
    await sendJson(`/api/admin/membership-catalog/add-ons/${addOn.id}`, 'PATCH', { archived }).catch(() => null);
    await load();
  }

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Paid extras on top of a membership. An add-on with no price stays inactive.
        </Typography>
        <Button variant="contained" onClick={() => open(null)} sx={{ flexShrink: 0 }}>
          New Add-on
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Studio</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Members with it</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {addOns.map((addOn) => (
              <TableRow key={addOn.id} sx={addOn.archivedAt ? { opacity: 0.6 } : undefined}>
                <TableCell sx={{ fontWeight: 600 }}>{addOn.name}</TableCell>
                <TableCell>
                  {addOn.locationId === null
                    ? 'Every studio'
                    : (locations.find((l) => l.id === addOn.locationId)?.shortName ?? '—')}
                </TableCell>
                <TableCell>
                  {addOn.priceCents === null
                    ? 'Not priced'
                    : `${formatMoney(addOn.priceCents)} / ${billingPeriodLabel(addOn.billingIntervalDays)}`}
                </TableCell>
                <TableCell>{addOn._count.assignments}</TableCell>
                <TableCell>
                  <Chip
                    label={addOn.archivedAt ? 'Archived' : addOn.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={addOn.isActive ? 'success' : 'default'}
                    variant={addOn.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button size="small" variant="outlined" onClick={() => open(addOn)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color={addOn.archivedAt ? 'primary' : 'error'}
                      onClick={() => handleArchive(addOn, addOn.archivedAt === null)}
                    >
                      {addOn.archivedAt ? 'Restore' : 'Archive'}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {addOns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No add-ons yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Add-on' : 'New Add-on'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="addon-form" onSubmit={handleSubmit}>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="Name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
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
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Price ($)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                    value={form.priceDollars}
                    onChange={(e) => setField('priceDollars', e.target.value)}
                    helperText="Empty means not priced yet"
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Billing interval (days)"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.billingIntervalDays}
                    onChange={(e) => setField('billingIntervalDays', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    select
                    label="Studio"
                    value={form.locationId}
                    onChange={(e) => setField('locationId', e.target.value)}
                  >
                    <MenuItem value="">Every studio</MenuItem>
                    {locations.map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.shortName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />}
                label="Active"
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="addon-form" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
