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
import { centsToDollars, dollarsToCents, formatMoney, sendJson, slugify, toWholeNumber } from './shared';

interface CommitmentTerm {
  id: string;
  slug: string;
  name: string;
  months: number | null;
  joiningFeeCents: number;
  retailDiscountPercent: number;
  includesGuestPass: boolean;
  includesVideoLibrary: boolean;
  freeMonths: number;
  isActive: boolean;
  sortOrder: number;
  _count: { memberships: number };
}

interface FormState {
  name: string;
  slug: string;
  months: string;
  joiningFeeDollars: string;
  retailDiscountPercent: string;
  includesGuestPass: boolean;
  includesVideoLibrary: boolean;
  freeMonths: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  months: '',
  joiningFeeDollars: '',
  retailDiscountPercent: '',
  includesGuestPass: false,
  includesVideoLibrary: false,
  freeMonths: '',
  isActive: true,
  sortOrder: '',
};

function toForm(term: CommitmentTerm): FormState {
  return {
    name: term.name,
    slug: term.slug,
    months: term.months === null ? '' : String(term.months),
    joiningFeeDollars: centsToDollars(term.joiningFeeCents),
    retailDiscountPercent: String(term.retailDiscountPercent),
    includesGuestPass: term.includesGuestPass,
    includesVideoLibrary: term.includesVideoLibrary,
    freeMonths: String(term.freeMonths),
    isActive: term.isActive,
    sortOrder: String(term.sortOrder),
  };
}

export default function TermsTab() {
  const [terms, setTerms] = useState<CommitmentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommitmentTerm | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/membership-catalog/commitment-terms');
    if (res.ok) setTerms(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function open(term: CommitmentTerm | null) {
    setEditing(term);
    setForm(term ? toForm(term) : emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const months = toWholeNumber(form.months);
    const joiningFeeCents = dollarsToCents(form.joiningFeeDollars) ?? 0;
    const retailDiscountPercent = toWholeNumber(form.retailDiscountPercent) ?? 0;
    const freeMonths = toWholeNumber(form.freeMonths) ?? 0;
    const sortOrder = toWholeNumber(form.sortOrder) ?? 0;
    if ([months, joiningFeeCents, retailDiscountPercent, freeMonths, sortOrder].some((n) => Number.isNaN(n))) {
      setError('Check the numbers: they must be whole and can’t be negative.');
      return;
    }

    setSaving(true);
    try {
      await sendJson(
        editing
          ? `/api/admin/membership-catalog/commitment-terms/${editing.id}`
          : '/api/admin/membership-catalog/commitment-terms',
        editing ? 'PATCH' : 'POST',
        {
          name: form.name,
          slug: form.slug || slugify(form.name),
          months,
          joiningFeeCents,
          retailDiscountPercent,
          includesGuestPass: form.includesGuestPass,
          includesVideoLibrary: form.includesVideoLibrary,
          freeMonths,
          isActive: form.isActive,
          sortOrder,
        },
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
          A customer picks one of these when joining any public plan. They apply at every studio.
        </Typography>
        <Button variant="contained" onClick={() => open(null)} sx={{ flexShrink: 0 }}>
          New Term
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Length</TableCell>
              <TableCell>Joining fee</TableCell>
              <TableCell>Retail discount</TableCell>
              <TableCell>Perks</TableCell>
              <TableCell>Members</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {terms.map((term) => (
              <TableRow key={term.id}>
                <TableCell sx={{ fontWeight: 600 }}>{term.name}</TableCell>
                <TableCell>{term.months === null ? 'Month to month' : `${term.months} months`}</TableCell>
                <TableCell>{term.joiningFeeCents === 0 ? 'Waived' : formatMoney(term.joiningFeeCents)}</TableCell>
                <TableCell>{term.retailDiscountPercent === 0 ? '—' : `${term.retailDiscountPercent}%`}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                    {term.includesGuestPass && <Chip label="Guest pass" size="small" />}
                    {term.includesVideoLibrary && <Chip label="Video library" size="small" />}
                    {term.freeMonths > 0 && <Chip label={`${term.freeMonths} free month(s)`} size="small" />}
                  </Stack>
                </TableCell>
                <TableCell>{term._count.memberships}</TableCell>
                <TableCell>
                  <Chip
                    label={term.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={term.isActive ? 'success' : 'default'}
                    variant={term.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => open(term)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {terms.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No commitment terms yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Commitment Term' : 'New Commitment Term'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="term-form" onSubmit={handleSubmit}>
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
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Length (months)"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.months}
                    onChange={(e) => setField('months', e.target.value)}
                    helperText="Empty means month to month"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Joining fee ($)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                    value={form.joiningFeeDollars}
                    onChange={(e) => setField('joiningFeeDollars', e.target.value)}
                    helperText="Empty or 0 means waived"
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Retail discount (%)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, max: 100 } }}
                    value={form.retailDiscountPercent}
                    onChange={(e) => setField('retailDiscountPercent', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Free months"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.freeMonths}
                    onChange={(e) => setField('freeMonths', e.target.value)}
                    helperText="Shown to customers. Not billed automatically yet."
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    label="Sort order"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.sortOrder}
                    onChange={(e) => setField('sortOrder', e.target.value)}
                  />
                </Grid>
              </Grid>
              <Box>
                <FormControlLabel
                  control={
                    <Switch checked={form.includesGuestPass} onChange={(e) => setField('includesGuestPass', e.target.checked)} />
                  }
                  label="Includes the guest pass"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.includesVideoLibrary}
                      onChange={(e) => setField('includesVideoLibrary', e.target.checked)}
                    />
                  }
                  label="Includes the video library"
                />
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />}
                  label="Active: offered at checkout"
                />
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="term-form" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
