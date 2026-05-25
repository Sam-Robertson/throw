'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
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

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SearchIcon from '@mui/icons-material/Search';

interface PayRate {
  id: string;
  rateType: string;
  amountCents: number;
}

interface Instructor {
  id: string;
  name: string | null;
  email: string;
  role: 'STAFF' | 'ADMIN';
  defaultPayRate: PayRate | null;
}

interface Customer {
  id: string;
  name: string | null;
  email: string;
}

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email[0].toUpperCase();
}

function formatPayRate(pr: PayRate | null) {
  if (!pr) return '—';
  const dollars = (pr.amountCents / 100).toFixed(2).replace(/\.00$/, '');
  return `$${dollars} / ${pr.rateType === 'hourly' ? 'hr' : 'session'}`;
}

// ── Row-level overflow menu ────────────────────────────────────────────────
function RowMenu({
  instructor,
  onRemove,
}: {
  instructor: Instructor;
  onRemove: (i: Instructor) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{ color: 'text.secondary' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2 } } }}
      >
        <MenuItem
          component={NextLink}
          href={`/admin/studio-setup/pay-rates`}
          onClick={() => setAnchor(null)}
          sx={{ fontSize: '0.875rem' }}
        >
          <ListItemIcon><PaidOutlinedIcon fontSize="small" /></ListItemIcon>
          Manage pay rates
        </MenuItem>
        {instructor.role === 'STAFF' && [
          <Divider key="div" />,
          <MenuItem
            key="remove"
            onClick={() => { setAnchor(null); onRemove(instructor); }}
            sx={{ fontSize: '0.875rem', color: 'error.main' }}
          >
            <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            Remove instructor
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add instructor dialog
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<Instructor | null>(null);

  const load = useCallback(async () => {
    const [staffRes, custRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/customers?page=1&limit=500'),
    ]);
    if (staffRes.ok) setInstructors(await staffRes.json() as Instructor[]);
    if (custRes.ok) {
      const data = await custRes.json() as { customers: Customer[] };
      setCustomers(data.customers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return instructors;
    return instructors.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q),
    );
  }, [instructors, search]);

  // Selection helpers
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const someSelected = filtered.some((i) => selected.has(i.id)) && !allSelected;
  const selectedCount = selected.size;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((i) => next.add(i.id));
        return next;
      });
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleAdd() {
    if (!selectedUserId) return;
    setAddSaving(true);
    setAddError(null);
    const res = await fetch(`/api/admin/users/${selectedUserId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'STAFF' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setAddError(data.error ?? 'Failed to add instructor');
    } else {
      setAddOpen(false);
      setSelectedUserId('');
      await load();
    }
    setAddSaving(false);
  }

  async function handleRemove(instructor: Instructor) {
    setRemoveTarget(null);
    await fetch(`/api/admin/users/${instructor.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'CUSTOMER' }),
    });
    setSelected((prev) => { const next = new Set(prev); next.delete(instructor.id); return next; });
    await load();
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Page header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>Instructors</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setAddError(null); setSelectedUserId(''); setAddOpen(true); }}
          >
            Add new instructor
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Toolbar ── */}
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
            gap: 1,
          }}
        >
          {/* Left: total count (or selection count) */}
          <Box>
            {selectedCount > 0 ? (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedCount} selected
              </Typography>
            ) : (
              <Stack spacing={0}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Total</Typography>
                <Typography variant="body2" color="text.secondary">
                  {instructors.length} instructor{instructors.length !== 1 ? 's' : ''}
                </Typography>
              </Stack>
            )}
          </Box>

          {/* Right: search */}
          <TextField
            size="small"
            placeholder="Search instructors…"
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
        </Stack>

        {/* ── Table ── */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    disabled={filtered.length === 0}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  Instructor name
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  E-mail
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                  Default pay rate
                </TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <PersonAddAlt1OutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search ? 'No instructors match your search' : 'No instructors yet'}
                    </Typography>
                    {!search && (
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                        Add a customer as an instructor to get started.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((instructor) => {
                  const isSelected = selected.has(instructor.id);
                  return (
                    <TableRow
                      key={instructor.id}
                      selected={isSelected}
                      hover
                      sx={{ cursor: 'default' }}
                    >
                      <TableCell padding="checkbox" sx={{ pl: 2 }}>
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => toggleRow(instructor.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              flexShrink: 0,
                            }}
                          >
                            {initials(instructor.name, instructor.email)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {instructor.name ?? '—'}
                            </Typography>
                            {instructor.role === 'ADMIN' && (
                              <Chip
                                label="Admin"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', mt: 0.25 }}
                              />
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {instructor.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                          {instructor.defaultPayRate ? (
                            <>
                              <EditOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formatPayRate(instructor.defaultPayRate)}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell padding="checkbox" sx={{ pr: 1 }}>
                        <RowMenu instructor={instructor} onRemove={setRemoveTarget} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Add instructor dialog ── */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add new instructor</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {addError && <Alert severity="error" sx={{ mb: 2 }}>{addError}</Alert>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Promoting a customer to Staff gives them access to the admin panel and lets them be assigned to sessions.
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="user-label">Customer</InputLabel>
              <Select
                labelId="user-label"
                value={selectedUserId}
                label="Customer"
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {customers.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    <Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.name ?? u.email}
                      </Typography>
                      {u.name && (
                        <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                      )}
                    </Stack>
                  </MenuItem>
                ))}
                {customers.length === 0 && (
                  <MenuItem disabled>No customers found</MenuItem>
                )}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)} disabled={addSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={addSaving || !selectedUserId}
          >
            {addSaving ? 'Adding…' : 'Add instructor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove confirmation ── */}
      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove instructor?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{removeTarget?.name ?? removeTarget?.email}</strong> will be moved back to a
            customer account and lose admin panel access. This can be reversed at any time.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => removeTarget && handleRemove(removeTarget)}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
