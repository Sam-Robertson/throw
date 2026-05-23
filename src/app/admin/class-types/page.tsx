'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

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
  name: '',
  description: '',
  durationMinutes: '90',
  capacity: '12',
  dropInPriceDollars: '20.00',
  isBusyWindow: false,
  isActive: true,
};

function toForm(st: SessionType): FormState {
  return {
    name: st.name,
    description: st.description ?? '',
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
    fetch('/api/admin/session-types')
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
      setFormError('Name is required');
      setSaving(false);
      return;
    }

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/session-types/${editTarget.id}` : '/api/admin/session-types';
    const method = isEdit ? 'PATCH' : 'POST';
    const prevList = sessionTypes;

    if (isEdit) {
      setSessionTypes((prev) =>
        prev.map((st) => (st.id === editTarget.id ? { ...st, ...payload, _count: st._count } : st)),
      );
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (isEdit) setSessionTypes(prevList);
      const data = await res.json().catch(() => ({})) as { error?: string };
      setFormError(data.error ?? 'Save failed');
      setSaving(false);
      return;
    }

    const saved = (await res.json()) as SessionType;
    if (isEdit) {
      setSessionTypes((prev) => prev.map((st) => (st.id === saved.id ? saved : st)));
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
    const res = await fetch(`/api/admin/session-types/${st.id}`, { method: 'DELETE' });
    if (!res.ok) setSessionTypes(prevList);
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Class Types
        </Typography>
        <Button variant="contained" onClick={openCreate}>
          New class type
        </Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Capacity</TableCell>
                <TableCell>Drop-in price</TableCell>
                <TableCell>Busy window</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Upcoming</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sessionTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No class types yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sessionTypes.map((st) => (
                  <TableRow
                    key={st.id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openEdit(st)}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{st.name}</TableCell>
                    <TableCell>{st.durationMinutes} min</TableCell>
                    <TableCell>{st.capacity}</TableCell>
                    <TableCell>${(st.dropInPriceCents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      {st.isBusyWindow ? (
                        <Chip label="Yes" size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">No</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={st.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={st.isActive ? 'success' : 'default'}
                        variant={st.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>{st._count.studioSessions}</TableCell>
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {st._count.studioSessions > 0 ? (
                        <Tooltip
                          title={`${st._count.studioSessions} upcoming session${st._count.studioSessions === 1 ? '' : 's'} — cannot delete`}
                        >
                          <span>
                            <Button
                              size="small"
                              color="error"
                              disabled
                            >
                              Delete
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Button
                          size="small"
                          color="error"
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
        </TableContainer>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editTarget ? 'Edit class type' : 'New class type'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              id="ct-name"
              label="Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
            <TextField
              id="ct-desc"
              label="Description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              multiline
              rows={2}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-duration"
                  label="Duration (min)"
                  type="number"
                  slotProps={{ htmlInput: { min: 15 } }}
                  value={form.durationMinutes}
                  onChange={(e) => setField('durationMinutes', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-capacity"
                  label="Capacity"
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={form.capacity}
                  onChange={(e) => setField('capacity', e.target.value)}
                />
              </Grid>
            </Grid>
            <TextField
              id="ct-price"
              label="Drop-in price ($)"
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              value={form.dropInPriceDollars}
              onChange={(e) => setField('dropInPriceDollars', e.target.value)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isBusyWindow}
                  onChange={(e) => setField('isBusyWindow', e.target.checked)}
                />
              }
              label="Requires member credit (busy window)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
