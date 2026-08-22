'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Location {
  id: string;
  name: string;
  isActive: boolean;
}

interface ShelfMembership {
  id: string;
  status: string;
  user: { id: string; name: string | null; email: string };
}

interface Shelf {
  id: string;
  number: number;
  shelfType: string;
  notes: string | null;
  membership: ShelfMembership | null;
}

interface WaitlistEntry {
  id: string;
  requestedType: string;
  createdAt: string;
  membership: ShelfMembership;
}

interface EligibleMember {
  membershipId: string;
  status: string;
  planName: string;
  userId: string;
  userName: string | null;
  userEmail: string;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  CANCELLED: 'error',
  EXPIRED: 'default',
};

export function ShelvesClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsClearingOnly, setNeedsClearingOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New shelf dialog
  const [newShelfOpen, setNewShelfOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newType, setNewType] = useState('FULL');

  // Assign dialog (shelf -> member search)
  const [assignShelf, setAssignShelf] = useState<Shelf | null>(null);
  const [assignQuery, setAssignQuery] = useState('');
  const [assignResults, setAssignResults] = useState<EligibleMember[]>([]);

  // Waitlist add dialog
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistType, setWaitlistType] = useState('FULL');
  const [waitlistQuery, setWaitlistQuery] = useState('');
  const [waitlistResults, setWaitlistResults] = useState<EligibleMember[]>([]);

  // Assign-from-waitlist dialog
  const [waitlistAssignEntry, setWaitlistAssignEntry] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    fetch('/api/admin/locations')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Location[]) => {
        setLocations(data);
        const first = data.find((l) => l.isActive) ?? data[0];
        if (first) setLocationId(first.id);
      });
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    const [shelvesRes, waitlistRes] = await Promise.all([
      fetch(`/api/admin/shelves?locationId=${locationId}`),
      fetch(`/api/admin/shelves/waitlist?locationId=${locationId}`),
    ]);
    if (shelvesRes.ok) setShelves(await shelvesRes.json());
    if (waitlistRes.ok) setWaitlist(await waitlistRes.json());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createShelf() {
    const number = parseInt(newNumber, 10);
    if (!number || number <= 0) return;
    setError(null);
    const res = await fetch('/api/admin/shelves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, number, shelfType: newType }),
    });
    if (res.ok) {
      setNewShelfOpen(false);
      setNewNumber('');
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to create shelf');
    }
  }

  async function updateNotes(shelfId: string, notes: string) {
    await fetch(`/api/admin/shelves/${shelfId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    await load();
  }

  async function unassign(shelfId: string) {
    if (!confirm('Unassign this shelf?')) return;
    await fetch(`/api/admin/shelves/${shelfId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId: null }),
    });
    await load();
  }

  async function deleteShelf(shelfId: string) {
    if (!confirm('Delete this shelf?')) return;
    const res = await fetch(`/api/admin/shelves/${shelfId}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  // ── Assign dialog ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!assignShelf || !assignQuery.trim()) {
      setAssignResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/shelves/eligible-members?shelfType=${assignShelf.shelfType}&q=${encodeURIComponent(assignQuery.trim())}`,
      );
      if (res.ok) setAssignResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [assignShelf, assignQuery]);

  async function assignMember(membershipId: string) {
    if (!assignShelf) return;
    setError(null);
    const res = await fetch(`/api/admin/shelves/${assignShelf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId }),
    });
    if (res.ok) {
      setAssignShelf(null);
      setAssignQuery('');
      setAssignResults([]);
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to assign shelf');
    }
  }

  // ── Waitlist add dialog ───────────────────────────────────────────────────
  useEffect(() => {
    if (!waitlistOpen || !waitlistQuery.trim()) {
      setWaitlistResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/shelves/eligible-members?shelfType=${waitlistType}&q=${encodeURIComponent(waitlistQuery.trim())}`,
      );
      if (res.ok) setWaitlistResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [waitlistOpen, waitlistType, waitlistQuery]);

  async function addToWaitlist(membershipId: string) {
    setError(null);
    const res = await fetch('/api/admin/shelves/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, membershipId, requestedType: waitlistType }),
    });
    if (res.ok) {
      setWaitlistOpen(false);
      setWaitlistQuery('');
      setWaitlistResults([]);
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to add to waitlist');
    }
  }

  async function removeFromWaitlist(id: string) {
    if (!confirm('Remove this waitlist entry?')) return;
    await fetch(`/api/admin/shelves/waitlist/${id}`, { method: 'DELETE' });
    await load();
  }

  async function assignFromWaitlist(shelfId: string) {
    if (!waitlistAssignEntry) return;
    setError(null);
    const res = await fetch(`/api/admin/shelves/${shelfId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId: waitlistAssignEntry.membership.id }),
    });
    if (res.ok) {
      await fetch(`/api/admin/shelves/waitlist/${waitlistAssignEntry.id}`, { method: 'DELETE' });
      setWaitlistAssignEntry(null);
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to assign shelf');
    }
  }

  const visibleShelves = needsClearingOnly
    ? shelves.filter(
        (s) => s.membership && (s.membership.status === 'CANCELLED' || s.membership.status === 'PAUSED'),
      )
    : shelves;

  const availableShelvesForWaitlistEntry = waitlistAssignEntry
    ? shelves.filter((s) => s.shelfType === waitlistAssignEntry.requestedType && !s.membership)
    : [];

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Shelf Spaces
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {locations.length > 1 && (
            <Select size="small" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
              ))}
            </Select>
          )}
          <Button variant="contained" onClick={() => setNewShelfOpen(true)}>
            New Shelf
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch checked={needsClearingOnly} onChange={(e) => setNeedsClearingOnly(e.target.checked)} />
        }
        label="Needs clearing only (cancelled or paused member assigned)"
      />

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mb: 5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>Loading…</Typography>
                </TableCell>
              </TableRow>
            ) : visibleShelves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>No shelves match.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleShelves.map((shelf) => (
                <ShelfRow
                  key={shelf.id}
                  shelf={shelf}
                  onAssign={() => setAssignShelf(shelf)}
                  onUnassign={() => unassign(shelf.id)}
                  onDelete={() => deleteShelf(shelf.id)}
                  onNotesSave={(notes) => updateNotes(shelf.id, notes)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Waitlist</Typography>
        <Button variant="outlined" onClick={() => setWaitlistOpen(true)}>Add to Waitlist</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Requested Type</TableCell>
              <TableCell>Date Added</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {waitlist.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>No one is waiting.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              waitlist.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.membership.user.name ?? entry.membership.user.email}</TableCell>
                  <TableCell>
                    <Chip label={entry.requestedType} size="small" />
                  </TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      <Button size="small" variant="outlined" onClick={() => setWaitlistAssignEntry(entry)}>
                        Assign to shelf
                      </Button>
                      <Button size="small" color="error" onClick={() => removeFromWaitlist(entry.id)}>
                        Remove
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New shelf dialog */}
      <Dialog open={newShelfOpen} onClose={() => setNewShelfOpen(false)}>
        <DialogTitle>New Shelf</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 280 }}>
            <TextField
              label="Number"
              type="number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              autoFocus
            />
            <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
              <MenuItem value="FULL">Full</MenuItem>
              <MenuItem value="HALF">Half</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewShelfOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createShelf}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assignShelf} onClose={() => { setAssignShelf(null); setAssignQuery(''); }} fullWidth maxWidth="xs">
        <DialogTitle>Assign Shelf #{assignShelf?.number}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            sx={{ mt: 1 }}
            placeholder="Search members by name or email…"
            value={assignQuery}
            onChange={(e) => setAssignQuery(e.target.value)}
            autoFocus
          />
          <Stack spacing={1} sx={{ mt: 2 }}>
            {assignResults.map((m) => (
              <Button
                key={m.membershipId}
                variant="outlined"
                onClick={() => assignMember(m.membershipId)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                {m.userName ?? m.userEmail} — {m.planName}
              </Button>
            ))}
            {assignQuery.trim() && assignResults.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No eligible members found for this shelf type.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssignShelf(null); setAssignQuery(''); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Waitlist add dialog */}
      <Dialog open={waitlistOpen} onClose={() => { setWaitlistOpen(false); setWaitlistQuery(''); }} fullWidth maxWidth="xs">
        <DialogTitle>Add to Waitlist</DialogTitle>
        <DialogContent>
          <Select
            fullWidth
            sx={{ mt: 1 }}
            value={waitlistType}
            onChange={(e) => setWaitlistType(e.target.value)}
          >
            <MenuItem value="FULL">Full shelf</MenuItem>
            <MenuItem value="HALF">Half shelf</MenuItem>
          </Select>
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            placeholder="Search members by name or email…"
            value={waitlistQuery}
            onChange={(e) => setWaitlistQuery(e.target.value)}
          />
          <Stack spacing={1} sx={{ mt: 2 }}>
            {waitlistResults.map((m) => (
              <Button
                key={m.membershipId}
                variant="outlined"
                onClick={() => addToWaitlist(m.membershipId)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                {m.userName ?? m.userEmail} — {m.planName}
              </Button>
            ))}
            {waitlistQuery.trim() && waitlistResults.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No eligible members found.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setWaitlistOpen(false); setWaitlistQuery(''); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assign from waitlist dialog */}
      <Dialog open={!!waitlistAssignEntry} onClose={() => setWaitlistAssignEntry(null)} fullWidth maxWidth="xs">
        <DialogTitle>Assign a Shelf</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {availableShelvesForWaitlistEntry.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No unassigned {waitlistAssignEntry?.requestedType.toLowerCase()} shelves available.
              </Typography>
            ) : (
              availableShelvesForWaitlistEntry.map((s) => (
                <Button
                  key={s.id}
                  variant="outlined"
                  onClick={() => assignFromWaitlist(s.id)}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Shelf #{s.number} ({s.shelfType})
                </Button>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWaitlistAssignEntry(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ShelfRow({
  shelf,
  onAssign,
  onUnassign,
  onDelete,
  onNotesSave,
}: {
  shelf: Shelf;
  onAssign: () => void;
  onUnassign: () => void;
  onDelete: () => void;
  onNotesSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(shelf.notes ?? '');
  const [editingNotes, setEditingNotes] = useState(false);

  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 600 }}>{shelf.number}</TableCell>
      <TableCell>
        <Chip label={shelf.shelfType} size="small" />
      </TableCell>
      <TableCell>
        {shelf.membership ? shelf.membership.user.name ?? shelf.membership.user.email : 'Empty'}
      </TableCell>
      <TableCell>
        {shelf.membership && (
          <Chip
            label={shelf.membership.status}
            size="small"
            color={STATUS_COLOR[shelf.membership.status] ?? 'default'}
          />
        )}
      </TableCell>
      <TableCell>
        {editingNotes ? (
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
            <Button
              size="small"
              onClick={() => {
                onNotesSave(notes);
                setEditingNotes(false);
              }}
            >
              Save
            </Button>
          </Stack>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ cursor: 'pointer' }}
            onClick={() => setEditingNotes(true)}
          >
            {shelf.notes || '— add note —'}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          {shelf.membership ? (
            <Button size="small" variant="outlined" color="error" onClick={onUnassign}>
              Unassign
            </Button>
          ) : (
            <>
              <Button size="small" variant="outlined" onClick={onAssign}>
                Assign
              </Button>
              <Button size="small" color="error" onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}
