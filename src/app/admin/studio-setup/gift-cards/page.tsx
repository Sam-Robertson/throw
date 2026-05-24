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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';

interface GiftCard {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateForm {
  code: string;
  initialDollars: string;
  expiresAt: string;
}

const emptyCreate: CreateForm = {
  code: '',
  initialDollars: '',
  expiresAt: '',
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, (_, i) => {
    const c = chars[Math.floor(Math.random() * chars.length)];
    return i === 4 || i === 8 ? `-${c}` : c;
  }).join('');
}

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<GiftCard | null>(null);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/gift-cards');
    if (res.ok) setCards(await res.json() as GiftCard[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setForm({ ...emptyCreate, code: generateCode() });
    setError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);

    const initialCents = Math.round(parseFloat(form.initialDollars) * 100);
    if (!form.code.trim() || !initialCents) {
      setError('Code and initial value are required');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/admin/gift-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code.trim(),
        initialCents,
        expiresAt: form.expiresAt || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Create failed');
    } else {
      setCreateOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDeactivate(card: GiftCard) {
    setDeactivateTarget(null);
    await fetch(`/api/admin/gift-cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    await load();
  }

  function balancePct(card: GiftCard) {
    if (!card.initialCents) return 0;
    return Math.round((card.balanceCents / card.initialCents) * 100);
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Gift Cards</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Issue and manage gift cards for the studio.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>Issue Gift Card</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No gift cards yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {card.code}
                      </Typography>
                    </TableCell>
                    <TableCell>${(card.initialCents / 100).toFixed(2)}</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Tooltip title={`$${(card.balanceCents / 100).toFixed(2)} remaining`}>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">${(card.balanceCents / 100).toFixed(2)}</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={balancePct(card)}
                            sx={{ height: 4, borderRadius: 2 }}
                          />
                        </Stack>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={card.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={card.isActive ? 'success' : 'default'}
                        variant={card.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {card.isActive && (
                        <Button size="small" color="error" onClick={() => setDeactivateTarget(card)}>
                          Deactivate
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Issue Gift Card</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
              <TextField
                label="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontWeight: 700 } } }}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" size="small" onClick={() => setForm({ ...form, code: generateCode() })} sx={{ mb: 0.25, whiteSpace: 'nowrap' }}>
                Regenerate
              </Button>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Initial Value ($)"
                  type="number"
                  slotProps={{ htmlInput: { min: 1, step: 0.01 } }}
                  value={form.initialDollars}
                  onChange={(e) => setForm({ ...form, initialDollars: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Expires (optional)"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Issuing…' : 'Issue'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deactivateTarget !== null} onClose={() => setDeactivateTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Deactivate gift card?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Card <strong>{deactivateTarget?.code}</strong> will be deactivated and cannot be used. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deactivateTarget && handleDeactivate(deactivateTarget)}>
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
