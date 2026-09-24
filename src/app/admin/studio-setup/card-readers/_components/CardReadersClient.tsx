'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

/**
 * Studio setup → Card readers.
 *
 * Two things happen here, in order: a studio is linked to a Stripe Terminal
 * Location, then readers are paired to it with the code from the device.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface Location {
  id: string;
  name: string;
  address: string | null;
  stripeTerminalLocationId: string | null;
}

interface Reader {
  id: string;
  label: string;
  deviceType: string;
  status: string;
  busy: boolean;
}

interface TippingSetup {
  enabled: boolean;
  configurationId: string | null;
  percentages: number[];
  fixedAmountsCents: number[];
  smartTipThresholdCents: number | null;
}

export function CardReadersClient({ locations: initial }: { locations: Location[] }) {
  const [locations, setLocations] = useState(initial);
  const [locationId, setLocationId] = useState(initial[0]?.id ?? '');
  const [readers, setReaders] = useState<Reader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [addr, setAddr] = useState({ line1: '', city: '', state: 'UT', postalCode: '' });

  const [pairOpen, setPairOpen] = useState(false);
  const [pair, setPair] = useState({ registrationCode: '', label: '' });

  // On-reader tipping is one Stripe account setting, shared by every studio.
  const [tipping, setTipping] = useState<TippingSetup | null>(null);
  const [tippingError, setTippingError] = useState<string | null>(null);
  const [tippingBusy, setTippingBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/terminal/tipping')
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setTipping(data);
        else setTippingError(data.error ?? 'Could not check the tipping setup.');
      })
      .catch(() => setTippingError('Could not check the tipping setup.'));
  }, []);

  async function setTippingEnabled(enabled: boolean) {
    setTippingBusy(true);
    setTippingError(null);
    try {
      const res = await fetch('/api/admin/terminal/tipping', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTippingError(data.error ?? 'Could not update the tipping setup.');
        return;
      }
      setTipping(data);
    } finally {
      setTippingBusy(false);
    }
  }

  const location = locations.find((l) => l.id === locationId);

  const loadReaders = useCallback(async () => {
    if (!locationId) return;
    setReaders(null);
    try {
      const res = await fetch(`/api/admin/terminal/readers?locationId=${locationId}`);
      const data = await res.json();
      setReaders(data.readers ?? []);
      // A 409 here just means "not linked yet", which the UI already explains.
      if (!res.ok && res.status !== 409) setError(data.error ?? 'Could not load readers.');
    } catch {
      setError('Could not load readers.');
      setReaders([]);
    }
  }, [locationId]);

  useEffect(() => {
    setError(null);
    if (location?.stripeTerminalLocationId) void loadReaders();
    else setReaders([]);
  }, [location?.stripeTerminalLocationId, loadReaders]);

  async function link() {
    if (!location) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/terminal/locations', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ locationId: location.id, ...addr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not link this studio.');
        return;
      }
      setLocations((prev) =>
        prev.map((l) =>
          l.id === location.id
            ? { ...l, stripeTerminalLocationId: data.terminalLocationId }
            : l,
        ),
      );
      setLinkOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function registerReader() {
    if (!location) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/terminal/readers', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ locationId: location.id, ...pair }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not pair that reader.');
        return;
      }
      setPairOpen(false);
      setPair({ registrationCode: '', label: '' });
      await loadReaders();
    } finally {
      setBusy(false);
    }
  }

  async function removeReader(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/terminal/readers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Could not remove that reader.');
        return;
      }
      await loadReaders();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Card readers
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pair a BBPOS WisePOS E to a studio so the POS can take tap and chip payments.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Studio</InputLabel>
          <Select
            label="Studio"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {location && !location.stripeTerminalLocationId ? (
          <Button
            variant="contained"
            onClick={() => {
              setAddr((a) => ({ ...a, line1: location.address ?? '' }));
              setLinkOpen(true);
            }}
          >
            Set up card readers here
          </Button>
        ) : (
          <Button variant="contained" onClick={() => setPairOpen(true)}>
            Pair a reader
          </Button>
        )}
      </Stack>

      {location && !location.stripeTerminalLocationId && (
        <Alert severity="info">
          {location.name} isn&apos;t set up for card readers yet. Setting it up registers
          it with Stripe so readers can be paired to it.
        </Alert>
      )}

      {location?.stripeTerminalLocationId && (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reader</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {readers === null && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
                {readers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                      No readers paired yet.
                    </TableCell>
                  </TableRow>
                )}
                {readers?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{r.deviceType}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.status === 'online' ? (r.busy ? 'In use' : 'Ready') : 'Offline'}
                        color={r.status === 'online' ? 'success' : 'default'}
                        variant={r.status === 'online' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => removeReader(r.id)} disabled={busy}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Stripe Terminal location <code>{location.stripeTerminalLocationId}</code>
          </Typography>
        </>
      )}

      {/* ── On-reader tipping ───────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mt: 4, p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Tip screen on the reader
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When on, every card payment on a reader asks the customer for a tip
              before they tap. This is one Stripe setting for all studios. Other
              tenders ask on the POS screen, and Add tip in the cart stays as a
              manual backup.
            </Typography>
          </Box>
          {tipping === null && !tippingError && <CircularProgress size={20} />}
          {tipping && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Chip
                size="small"
                label={tipping.enabled ? 'On' : 'Off'}
                color={tipping.enabled ? 'success' : 'default'}
                variant={tipping.enabled ? 'filled' : 'outlined'}
              />
              <Button
                variant={tipping.enabled ? 'outlined' : 'contained'}
                onClick={() => setTippingEnabled(!tipping.enabled)}
                disabled={tippingBusy}
              >
                {tippingBusy ? 'Saving…' : tipping.enabled ? 'Turn off' : 'Turn on'}
              </Button>
            </Stack>
          )}
        </Stack>
        {tipping?.enabled && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Options: {tipping.percentages.map((p) => `${p}%`).join(' / ') || '—'}
            {tipping.smartTipThresholdCents !== null &&
              ` (under $${(tipping.smartTipThresholdCents / 100).toFixed(0)}: ${tipping.fixedAmountsCents.map((c) => `$${c / 100}`).join(' / ')})`}
          </Typography>
        )}
        {tippingError && (
          <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setTippingError(null)}>
            {tippingError}
          </Alert>
        )}
      </Paper>

      {/* ── Link studio ─────────────────────────────────────────────────── */}
      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Set up card readers at {location?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Stripe needs the studio&apos;s street address to register readers there.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Street address"
              value={addr.line1}
              onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="City"
                value={addr.city}
                onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                fullWidth
              />
              <TextField
                label="State"
                value={addr.state}
                onChange={(e) => setAddr({ ...addr, state: e.target.value })}
                sx={{ width: 100 }}
              />
              <TextField
                label="ZIP"
                value={addr.postalCode}
                onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })}
                sx={{ width: 140 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={link} disabled={busy}>
            Set up
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Pair reader ─────────────────────────────────────────────────── */}
      <Dialog open={pairOpen} onClose={() => setPairOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Pair a reader</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            On the WisePOS E: swipe in from the left edge, tap Settings, enter the admin
            PIN, then Generate pairing code. Enter the three words below.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Pairing code"
              placeholder="e.g. puppies-plug-could"
              value={pair.registrationCode}
              onChange={(e) => setPair({ ...pair, registrationCode: e.target.value })}
              fullWidth
            />
            <TextField
              label="Name this reader (optional)"
              placeholder="Front desk"
              value={pair.label}
              onChange={(e) => setPair({ ...pair, label: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPairOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={registerReader} disabled={busy || !pair.registrationCode}>
            Pair
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
