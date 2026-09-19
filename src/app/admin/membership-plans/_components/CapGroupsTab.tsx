'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
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
import { useLocationFilter, withLocationParam } from '../../_components/LocationFilterContext';
import { sendJson, slugify, toWholeNumber } from './shared';

interface CapGroup {
  id: string;
  slug: string;
  name: string;
  cap: number;
  sold: number;
  locationId: string | null;
  plans: Array<{ id: string; name: string }>;
}

interface FormState {
  name: string;
  slug: string;
  cap: string;
  locationId: string;
}

const emptyForm: FormState = { name: '', slug: '', cap: '', locationId: '' };

export default function CapGroupsTab() {
  const { locations, selectedLocationId } = useLocationFilter();
  const [groups, setGroups] = useState<CapGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CapGroup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(withLocationParam('/api/admin/membership-catalog/cap-groups', selectedLocationId));
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  }, [selectedLocationId]);

  useEffect(() => {
    load();
  }, [load]);

  function open(group: CapGroup | null) {
    setEditing(group);
    setForm(
      group
        ? { name: group.name, slug: group.slug, cap: String(group.cap), locationId: group.locationId ?? '' }
        : emptyForm,
    );
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cap = toWholeNumber(form.cap);
    if (cap === null || Number.isNaN(cap)) {
      setError('The cap must be a whole number.');
      return;
    }

    setSaving(true);
    try {
      await sendJson(
        editing ? `/api/admin/membership-catalog/cap-groups/${editing.id}` : '/api/admin/membership-catalog/cap-groups',
        editing ? 'PATCH' : 'POST',
        { name: form.name, slug: form.slug || slugify(form.name), cap, locationId: form.locationId || null },
      );
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setSaving(false);
  }

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          A cap group limits how many memberships can be sold across all the plans in it. Active and
          frozen memberships count. Put a plan in a group from the plan’s own form.
        </Typography>
        <Button variant="contained" onClick={() => open(null)} sx={{ flexShrink: 0 }}>
          New Cap Group
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Studio</TableCell>
              <TableCell>Sold</TableCell>
              <TableCell>Plans</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell sx={{ fontWeight: 600 }}>{group.name}</TableCell>
                <TableCell>
                  {group.locationId === null
                    ? 'Every studio'
                    : (locations.find((l) => l.id === group.locationId)?.shortName ?? '—')}
                </TableCell>
                <TableCell>
                  {group.sold} / {group.cap}
                </TableCell>
                <TableCell>{group.plans.map((p) => p.name).join(', ') || '—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => open(group)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No cap groups yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Cap Group' : 'New Cap Group'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="cap-group-form" onSubmit={handleSubmit}>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    helperText={editing ? undefined : 'Empty: made from the name'}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Cap"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.cap}
                    onChange={(e) => setForm((prev) => ({ ...prev, cap: e.target.value }))}
                    helperText={editing ? `${editing.sold} sold so far` : undefined}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Studio"
                    value={form.locationId}
                    onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
                  >
                    <MenuItem value="">Every studio</MenuItem>
                    {locations.map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.shortName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="cap-group-form" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
