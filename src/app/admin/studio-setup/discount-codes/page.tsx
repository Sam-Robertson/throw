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
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
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
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

interface FormState {
  code: string;
  description: string;
  type: string;
  value: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  maxUses: '',
  validFrom: '',
  validUntil: '',
  isActive: true,
};

function toForm(d: DiscountCode): FormState {
  return {
    code: d.code,
    description: d.description ?? '',
    type: d.type,
    value: String(d.value),
    maxUses: d.maxUses ? String(d.maxUses) : '',
    validFrom: d.validFrom ? d.validFrom.slice(0, 10) : '',
    validUntil: d.validUntil ? d.validUntil.slice(0, 10) : '',
    isActive: d.isActive,
  };
}

function formatValue(d: DiscountCode) {
  if (d.type === 'percent') return `${d.value}%`;
  return `$${(d.value / 100).toFixed(2)}`;
}

export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DiscountCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiscountCode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/discount-codes');
    if (res.ok) setCodes(await res.json() as DiscountCode[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(d: DiscountCode) {
    setEditTarget(d);
    setForm(toForm(d));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const value = parseFloat(form.value);
    if (!form.code.trim() || isNaN(value)) {
      setError('Code and value are required');
      setSaving(false);
      return;
    }

    const payload = {
      code: form.code.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      value,
      maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
      isActive: form.isActive,
    };

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/discount-codes/${editTarget.id}` : '/api/admin/discount-codes';
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

  async function handleDelete(d: DiscountCode) {
    setDeleteTarget(null);
    await fetch(`/api/admin/discount-codes/${d.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Discount Codes</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Percentage or fixed-amount discount codes for bookings and memberships.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New Code</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Uses</TableCell>
                <TableCell>Valid Until</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {codes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No discount codes yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                codes.map((d) => (
                  <TableRow key={d.id} sx={{ cursor: 'pointer' }} onClick={() => openEdit(d)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {d.code}
                      </Typography>
                      {d.description && (
                        <Typography variant="caption" color="text.secondary">{d.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={formatValue(d)} size="small" variant="outlined" color="primary" />
                    </TableCell>
                    <TableCell>
                      {d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {d.validUntil ? new Date(d.validUntil).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={d.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={d.isActive ? 'success' : 'default'}
                        variant={d.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" color="error" onClick={() => setDeleteTarget(d)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Discount Code' : 'New Discount Code'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              disabled={!!editTarget}
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontWeight: 700 }, placeholder: 'SUMMER20' } }}
            />
            <TextField
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="type-label">Type</InputLabel>
                  <Select
                    labelId="type-label"
                    value={form.type}
                    label="Type"
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <MenuItem value="percent">Percentage (%)</MenuItem>
                    <MenuItem value="fixed_cents">Fixed Amount ($)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label={form.type === 'percent' ? 'Discount (%)' : 'Amount (cents)'}
                  type="number"
                  slotProps={{ htmlInput: { min: 0, max: form.type === 'percent' ? 100 : undefined } }}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              label="Max Uses (optional, blank = unlimited)"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Valid From"
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Valid Until"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active"
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

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete code &ldquo;{deleteTarget?.code}&rdquo;?</DialogTitle>
        <DialogContent><DialogContentText>This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
