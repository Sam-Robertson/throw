'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { shortLocationName } from '@/lib/locationName';
import { useLocationFilter, withLocationParam } from '../../_components/LocationFilterContext';
import { centsToDollars, dollarsToCents, sendJson } from './shared';

interface FreezePolicyRow {
  location: { id: string; name: string; address: string | null };
  policy: {
    monthlyFeeCents: number | null;
    creditCentsPerFrozenMonth: number | null;
    forfeitsFoundingRate: boolean;
  } | null;
}

interface FormState {
  monthlyFeeDollars: string;
  creditDollars: string;
  /** null until a policy exists or the switch is touched: the save then leaves it to the database default. */
  forfeitsFoundingRate: boolean | null;
}

function StudioPolicyCard({ row, onSaved }: { row: FreezePolicyRow; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<FormState>({
    monthlyFeeDollars: centsToDollars(row.policy?.monthlyFeeCents ?? null),
    creditDollars: centsToDollars(row.policy?.creditCentsPerFrozenMonth ?? null),
    forfeitsFoundingRate: row.policy?.forfeitsFoundingRate ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const monthlyFeeCents = dollarsToCents(form.monthlyFeeDollars);
    const creditCentsPerFrozenMonth = dollarsToCents(form.creditDollars);
    if (Number.isNaN(monthlyFeeCents) || Number.isNaN(creditCentsPerFrozenMonth)) {
      setMessage({ severity: 'error', text: 'Amounts can’t be negative.' });
      return;
    }

    setSaving(true);
    try {
      const saved = await sendJson<NonNullable<FreezePolicyRow['policy']>>(
        `/api/admin/membership-catalog/freeze-policies/${row.location.id}`,
        'PUT',
        {
          monthlyFeeCents,
          creditCentsPerFrozenMonth,
          ...(form.forfeitsFoundingRate === null ? {} : { forfeitsFoundingRate: form.forfeitsFoundingRate }),
        },
      );
      setForm((prev) => ({ ...prev, forfeitsFoundingRate: saved.forfeitsFoundingRate }));
      setMessage({ severity: 'success', text: 'Saved.' });
      await onSaved();
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
    }
    setSaving(false);
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {shortLocationName(row.location.name, row.location.address)}
          </Typography>
          {row.policy === null && <Alert severity="info">No freeze policy saved for this studio yet.</Alert>}
          {message && <Alert severity={message.severity}>{message.text}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Monthly fee while frozen ($)"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                value={form.monthlyFeeDollars}
                onChange={(e) => setForm((prev) => ({ ...prev, monthlyFeeDollars: e.target.value }))}
                helperText="Empty means not decided yet"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Credit per frozen month ($)"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                value={form.creditDollars}
                onChange={(e) => setForm((prev) => ({ ...prev, creditDollars: e.target.value }))}
                helperText="Empty means not decided yet"
              />
            </Grid>
          </Grid>
          <FormControlLabel
            control={
              <Switch
                checked={form.forfeitsFoundingRate ?? false}
                onChange={(e) => setForm((prev) => ({ ...prev, forfeitsFoundingRate: e.target.checked }))}
              />
            }
            label="Freezing loses a founding rate"
          />
          <Box>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

export default function FreezePolicyTab() {
  const { selectedLocationId } = useLocationFilter();
  const [rows, setRows] = useState<FreezePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(withLocationParam('/api/admin/membership-catalog/freeze-policies', selectedLocationId));
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }, [selectedLocationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Typography color="text.secondary">Loading…</Typography>;

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        What a member pays and earns while their membership is frozen, per studio. These are stored
        here for staff; freezing a membership does not charge or credit them automatically yet.
      </Typography>
      {rows.map((row) => (
        <StudioPolicyCard key={row.location.id} row={row} onSaved={load} />
      ))}
      {rows.length === 0 && <Typography color="text.secondary">No studios to show.</Typography>}
    </Stack>
  );
}
