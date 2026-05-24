'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  _count: { studioSessions: number; memberships: number };
}

interface FormState {
  name: string;
  address: string;
  timezone: string;
}

const emptyForm: FormState = {
  name: '',
  address: '',
  timezone: 'America/Denver',
};

function toForm(l: Location): FormState {
  return {
    name: l.name,
    address: l.address ?? '',
    timezone: l.timezone,
  };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/locations');
    if (res.ok) setLocations(await res.json() as Location[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(l: Location) {
    setEditTarget(l);
    setForm(toForm(l));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    if (!form.name.trim()) { setError('Name is required'); setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      timezone: form.timezone,
    };

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/locations/${editTarget.id}` : '/api/admin/locations';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Save failed');
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleToggle(l: Location) {
    await fetch(`/api/admin/locations/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    await load();
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Locations</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Physical studio locations used for sessions, memberships, and reporting.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New Location</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Timezone</TableCell>
                <TableCell>Sessions</TableCell>
                <TableCell>Members</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No locations yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{l.name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{l.address ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {l.timezone}
                      </Typography>
                    </TableCell>
                    <TableCell>{l._count.studioSessions}</TableCell>
                    <TableCell>{l._count.memberships}</TableCell>
                    <TableCell>
                      <Chip
                        label={l.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={l.isActive ? 'success' : 'default'}
                        variant={l.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openEdit(l)}>Edit</Button>
                        <Button
                          size="small"
                          variant={l.isActive ? 'outlined' : 'contained'}
                          color={l.isActive ? 'error' : 'primary'}
                          onClick={() => handleToggle(l)}
                        >
                          {l.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Location' : 'New Location'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Location Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Downtown Studio"
            />
            <TextField
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Clay St, Denver, CO 80201"
              multiline
              rows={2}
            />
            <FormControl fullWidth>
              <InputLabel id="tz-label">Timezone</InputLabel>
              <Select
                labelId="tz-label"
                value={form.timezone}
                label="Timezone"
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
