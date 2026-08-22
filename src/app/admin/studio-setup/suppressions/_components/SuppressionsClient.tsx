'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
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
import SearchIcon from '@mui/icons-material/Search';

interface SuppressionRow {
  id: string;
  channel: string;
  value: string;
  reason: string;
  userId: string | null;
  userName: string | null;
  note: string | null;
  createdAt: string;
}

const REASONS = ['USER_UNSUBSCRIBED', 'STOP_REPLY', 'BOUNCE', 'COMPLAINT', 'MANUAL'];

const REASON_LABEL: Record<string, string> = {
  USER_UNSUBSCRIBED: 'User Unsubscribed',
  STOP_REPLY: 'STOP Reply',
  BOUNCE: 'Bounce',
  COMPLAINT: 'Complaint',
  MANUAL: 'Manual',
};

const REASON_COLOR: Record<string, 'default' | 'warning' | 'error'> = {
  USER_UNSUBSCRIBED: 'default',
  STOP_REPLY: 'warning',
  BOUNCE: 'error',
  COMPLAINT: 'error',
  MANUAL: 'default',
};

function maskValue(channel: string, value: string): string {
  if (channel === 'EMAIL') {
    const atIndex = value.indexOf('@');
    if (atIndex === -1) return value;
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    if (local.length <= 2) return `${local[0] ?? ''}*@${domain}`;
    const masked = local[0] + '*'.repeat(Math.max(local.length - 2, 1)) + local[local.length - 1];
    return `${masked}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  const prefix = value.startsWith('+') ? '+' : '';
  return `${prefix}${'•'.repeat(Math.max(digits.length - 4, 0))}${last4}`;
}

export function SuppressionsClient() {
  const [entries, setEntries] = useState<SuppressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [removeTarget, setRemoveTarget] = useState<SuppressionRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (channelFilter !== 'ALL') params.set('channel', channelFilter);
    if (reasonFilter !== 'ALL') params.set('reason', reasonFilter);
    const res = await fetch(`/api/admin/suppressions?${params.toString()}`);
    if (res.ok) setEntries((await res.json()) as SuppressionRow[]);
    setLoading(false);
  }, [search, channelFilter, reasonFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await fetch(`/api/admin/suppressions/${removeTarget.id}`, { method: 'DELETE' });
    setRemoving(false);
    if (res.ok) {
      setRemoveTarget(null);
      await load();
    }
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Suppressions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Contacts who have opted out of marketing sends. Transactional messages are never
          affected by this list.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <TextField
            size="small"
            placeholder="Search by value…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: '100%', sm: 220 } }}
          />

          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="channel-filter-label">Channel</InputLabel>
              <Select
                labelId="channel-filter-label"
                label="Channel"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <MenuItem value="ALL">All channels</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="EMAIL">Email</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="reason-filter-label">Reason</InputLabel>
              <Select
                labelId="reason-filter-label"
                label="Reason"
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
              >
                <MenuItem value="ALL">All reasons</MenuItem>
                {REASONS.map((r) => (
                  <MenuItem key={r} value={r}>{REASON_LABEL[r]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Channel</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Linked User</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Created</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      No suppression entries match
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>
                      <Chip
                        label={entry.channel}
                        size="small"
                        color={entry.channel === 'SMS' ? 'primary' : 'secondary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {maskValue(entry.channel, entry.value)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={REASON_LABEL[entry.reason] ?? entry.reason}
                        size="small"
                        color={REASON_COLOR[entry.reason] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={entry.userName ? 'text.primary' : 'text.disabled'}>
                        {entry.userName ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell padding="checkbox" sx={{ pr: 1, whiteSpace: 'nowrap' }}>
                      <Button size="small" onClick={() => setRemoveTarget(entry)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Remove confirmation */}
      <Dialog open={removeTarget !== null} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove suppression?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              This removes <strong>{removeTarget ? maskValue(removeTarget.channel, removeTarget.value) : ''}</strong>{' '}
              from the suppression list.
            </Typography>
            <Alert severity="warning">
              Removing a suppression does not itself grant consent. The person must opt in
              again before any marketing message is sent to them.
            </Alert>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRemoveTarget(null)} disabled={removing}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
