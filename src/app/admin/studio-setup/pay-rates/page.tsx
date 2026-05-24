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

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface PayRate {
  id: string;
  userId: string;
  rateType: string;
  amountCents: number;
  notes: string | null;
  isActive: boolean;
  user: { id: string; name: string | null; email: string };
}

interface FormState {
  userId: string;
  rateType: string;
  amountDollars: string;
  notes: string;
}

const emptyForm: FormState = {
  userId: '',
  rateType: 'hourly',
  amountDollars: '',
  notes: '',
};

export default function PayRatesPage() {
  const [payRates, setPayRates] = useState<PayRate[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PayRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayRate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [ratesRes, staffRes] = await Promise.all([
      fetch('/api/admin/pay-rates'),
      fetch('/api/admin/staff'),
    ]);
    if (ratesRes.ok) setPayRates(await ratesRes.json() as PayRate[]);
    if (staffRes.ok) setStaff(await staffRes.json() as StaffUser[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(pr: PayRate) {
    setEditTarget(pr);
    setForm({
      userId: pr.userId,
      rateType: pr.rateType,
      amountDollars: (pr.amountCents / 100).toFixed(2),
      notes: pr.notes ?? '',
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (!form.userId || !amountCents) {
      setError('Staff member and amount are required');
      setSaving(false);
      return;
    }

    const payload = {
      userId: form.userId,
      rateType: form.rateType,
      amountCents,
      notes: form.notes.trim() || undefined,
    };

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/pay-rates/${editTarget.id}` : '/api/admin/pay-rates';
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

  async function handleDelete(pr: PayRate) {
    setDeleteTarget(null);
    await fetch(`/api/admin/pay-rates/${pr.id}`, { method: 'DELETE' });
    await load();
  }

  function formatRate(pr: PayRate) {
    const dollars = (pr.amountCents / 100).toFixed(2);
    return `$${dollars}/${pr.rateType === 'hourly' ? 'hr' : 'session'}`;
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Pay Rates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Hourly or per-session pay rates for instructors and staff.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New Pay Rate</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Staff Member</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {payRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No pay rates yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payRates.map((pr) => (
                  <TableRow key={pr.id} sx={{ cursor: 'pointer' }} onClick={() => openEdit(pr)}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {pr.user.name ?? pr.user.email}
                    </TableCell>
                    <TableCell>{formatRate(pr)}</TableCell>
                    <TableCell>
                      <Chip label={pr.rateType === 'hourly' ? 'Hourly' : 'Per Session'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{pr.notes ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pr.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={pr.isActive ? 'success' : 'default'}
                        variant={pr.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" color="error" onClick={() => setDeleteTarget(pr)}>Delete</Button>
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
        <DialogTitle>{editTarget ? 'Edit Pay Rate' : 'New Pay Rate'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <FormControl fullWidth>
              <InputLabel id="staff-label">Staff Member</InputLabel>
              <Select
                labelId="staff-label"
                value={form.userId}
                label="Staff Member"
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                disabled={!!editTarget}
              >
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name ?? s.email}{s.name ? ` (${s.email})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="type-label">Rate Type</InputLabel>
              <Select
                labelId="type-label"
                value={form.rateType}
                label="Rate Type"
                onChange={(e) => setForm({ ...form, rateType: e.target.value })}
              >
                <MenuItem value="hourly">Hourly</MenuItem>
                <MenuItem value="per_session">Per Session</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={form.rateType === 'hourly' ? 'Rate per hour ($)' : 'Rate per session ($)'}
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              value={form.amountDollars}
              onChange={(e) => setForm({ ...form, amountDollars: e.target.value })}
            />
            <TextField
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete pay rate?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
