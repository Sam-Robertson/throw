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
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
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
import MailOutlineIcon from '@mui/icons-material/EmailOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SearchIcon from '@mui/icons-material/Search';

interface PayRate {
  id: string;
  rateType: string;
  amountCents: number;
}

interface StudioAssignment {
  locationId: string;
  locationName: string;
  staffRoleId: string;
  staffRoleName: string;
}

interface Instructor {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: 'STAFF' | 'ADMIN';
  hasPassword: boolean;
  studios: StudioAssignment[];
  defaultPayRate: PayRate | null;
}

interface LocationRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface StaffRoleRow {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  permissions: Record<string, boolean>;
}

const PERMISSION_LABELS: Record<string, string> = {
  canViewTips: 'tips',
  canViewMembershipReporting: 'membership reports',
  canViewBilling: 'billing',
  canManageSchedule: 'schedule',
  canCheckInMembers: 'check-ins',
  canManageTasks: 'tasks',
  canUsePos: 'register',
};

const NO_ROLE = '';

/** The form behind both Add and Edit: who they are, and a role at each studio. */
interface FormState {
  name: string;
  email: string;
  phone: string;
  role: 'STAFF' | 'ADMIN';
  /** locationId → staffRoleId ('' = not at this studio). */
  roles: Record<string, string>;
  sendInvite: boolean;
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

function describePermissions(role: StaffRoleRow | undefined): string {
  if (!role) return '';
  const on = Object.entries(role.permissions)
    .filter(([, v]) => v)
    .map(([k]) => PERMISSION_LABELS[k] ?? k);
  // Everyone on the team can use the register at their studio (src/lib/permissions.ts).
  if (!on.includes('register')) on.push('register');
  return on.join(', ');
}

// ── Row-level overflow menu ────────────────────────────────────────────────
function RowMenu({
  instructor,
  isSelf,
  onEdit,
  onInvite,
  onRemove,
}: {
  instructor: Instructor;
  isSelf: boolean;
  onEdit: (i: Instructor) => void;
  onInvite: (i: Instructor) => void;
  onRemove: (i: Instructor) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions for ${instructor.name ?? instructor.email}`}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => { close(); onEdit(instructor); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          Edit details &amp; studios
        </MenuItem>
        <MenuItem
          component={NextLink}
          href={`/admin/studio-setup/pay-rates?userId=${instructor.id}`}
          onClick={close}
          sx={{ fontSize: '0.875rem' }}
        >
          <ListItemIcon><PaidOutlinedIcon fontSize="small" /></ListItemIcon>
          Manage pay rates
        </MenuItem>
        <MenuItem onClick={() => { close(); onInvite(instructor); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon><MailOutlineIcon fontSize="small" /></ListItemIcon>
          {instructor.hasPassword ? 'Send password reset' : 'Resend sign-in invite'}
        </MenuItem>
        {!isSelf && [
          <Divider key="div" />,
          <MenuItem
            key="remove"
            onClick={() => { close(); onRemove(instructor); }}
            sx={{ fontSize: '0.875rem', color: 'error.main' }}
          >
            <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            Remove from the team
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [roles, setRoles] = useState<StaffRoleRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [studioFilter, setStudioFilter] = useState('all');
  const [snack, setSnack] = useState<string | null>(null);

  // Add / edit dialog
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', role: 'STAFF', roles: {}, sendInvite: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<Instructor | null>(null);

  const load = useCallback(async () => {
    const [staffRes, locRes, rolesRes, sessionRes] = await Promise.all([
      fetch('/api/admin/instructors'),
      fetch('/api/admin/locations'),
      fetch('/api/admin/staff-roles'),
      fetch('/api/auth/session'),
    ]);
    if (staffRes.ok) setInstructors((await staffRes.json()) as Instructor[]);
    if (locRes.ok) setLocations(((await locRes.json()) as LocationRow[]).filter((l) => l.isActive));
    if (rolesRes.ok) setRoles((await rolesRes.json()) as StaffRoleRow[]);
    if (sessionRes.ok) {
      const data = (await sessionRes.json()) as { user?: { id?: string } } | null;
      setMyId(data?.user?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rolesByLocation = useMemo(() => {
    const map = new Map<string, StaffRoleRow[]>();
    for (const r of roles) map.set(r.locationId, [...(map.get(r.locationId) ?? []), r]);
    return map;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return instructors.filter((i) => {
      if (studioFilter !== 'all' && !i.studios.some((s) => s.locationId === studioFilter)) return false;
      if (!q) return true;
      return i.name?.toLowerCase().includes(q) || i.email.toLowerCase().includes(q);
    });
  }, [instructors, search, studioFilter]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', role: 'STAFF', roles: {}, sendInvite: true });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(i: Instructor) {
    setEditing(i);
    setForm({
      name: i.name ?? '',
      email: i.email,
      phone: i.phone ?? '',
      role: i.role,
      roles: Object.fromEntries(i.studios.map((s) => [s.locationId, s.staffRoleId])),
      sendInvite: false,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    const assignments = Object.entries(form.roles)
      .filter(([, staffRoleId]) => staffRoleId)
      .map(([locationId, staffRoleId]) => ({ locationId, staffRoleId }));
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      assignments,
      sendInvite: form.sendInvite,
    };
    const res = await fetch(editing ? `/api/admin/instructors/${editing.id}` : '/api/admin/instructors', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      setFormError('Could not reach the server.');
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      promoted?: boolean;
      invite?: { sent: boolean; error?: string };
    };
    if (!res.ok) {
      setFormError(data.error ?? 'Failed to save');
      return;
    }
    setFormOpen(false);
    if (editing) {
      setSnack('Saved.');
    } else if (data.invite?.sent) {
      setSnack(`Added. An email to set their password went to ${form.email.trim()}.`);
    } else if (form.sendInvite) {
      setSnack(
        `Added${data.promoted ? ' (their customer account was promoted)' : ''}, but the invite email didn't send${
          data.invite?.error ? ` (${data.invite.error})` : ''
        }. Use "Resend sign-in invite" once email is set up.`,
      );
    } else {
      setSnack('Added.');
    }
    await load();
  }

  async function sendInvite(i: Instructor) {
    const res = await fetch(`/api/admin/instructors/${i.id}`, { method: 'POST' }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string; mode?: string; to?: string } | undefined;
    if (res?.ok) {
      setSnack(`${data?.mode === 'reset' ? 'Password reset' : 'Sign-in invite'} emailed to ${data?.to ?? i.email}.`);
    } else {
      setSnack(`Email not sent${data?.error ? `: ${data.error}` : ''}.`);
    }
  }

  async function remove(i: Instructor) {
    setRemoveTarget(null);
    const res = await fetch(`/api/admin/instructors/${i.id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) setSnack(`${i.name ?? i.email} is a customer again.`);
    else {
      const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setSnack(data?.error ?? 'Could not remove them.');
    }
    await load();
  }

  const canSave = form.email.trim().length > 0 && (editing !== null || form.name.trim().length > 0) && !saving;

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Page header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2">Instructors</Typography>
          <Typography variant="body2" color="text.secondary">
            Everyone with admin access, the studios they work at and what their role lets them do.
            Roles themselves are set up under{' '}
            <NextLink href="/admin/studio-setup/roles" style={{ textDecoration: 'underline' }}>
              Roles &amp; Permissions
            </NextLink>
            .
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add instructor
        </Button>
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
          <Typography variant="body2" color="text.secondary">
            {filtered.length} of {instructors.length} on the team
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {locations.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="studio-filter-label">Studio</InputLabel>
                <Select
                  labelId="studio-filter-label"
                  label="Studio"
                  value={studioFilter}
                  onChange={(e) => setStudioFilter(e.target.value)}
                >
                  <MenuItem value="all">All studios</MenuItem>
                  {locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
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
        </Stack>

        {/* ── Table ── */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Instructor', 'Contact', 'Studios & roles', 'Default pay rate', 'Sign-in'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                    {h}
                  </TableCell>
                ))}
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
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <PersonAddAlt1OutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search || studioFilter !== 'all' ? 'No instructors match' : 'No instructors yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((instructor) => (
                  <TableRow key={instructor.id} hover>
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
                      <Typography variant="body2" color="text.secondary">{instructor.email}</Typography>
                      {instructor.phone && (
                        <Typography variant="caption" color="text.disabled">{instructor.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {instructor.studios.length === 0 ? (
                        <Typography variant="body2" color={instructor.role === 'ADMIN' ? 'text.secondary' : 'warning.main'}>
                          {instructor.role === 'ADMIN' ? 'Every studio (admin)' : 'No studio yet — can’t use the register'}
                        </Typography>
                      ) : (
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {instructor.studios.map((s) => (
                            <Chip
                              key={s.locationId}
                              size="small"
                              variant="outlined"
                              label={`${s.locationName} · ${s.staffRoleName}`}
                              title={describePermissions(roles.find((r) => r.id === s.staffRoleId))}
                            />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={instructor.defaultPayRate ? 'text.primary' : 'text.disabled'} sx={{ fontWeight: 500 }}>
                        {formatPayRate(instructor.defaultPayRate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={instructor.hasPassword ? 'text.secondary' : 'warning.main'}>
                        {instructor.hasPassword ? 'Has a password' : 'Not set up yet'}
                      </Typography>
                    </TableCell>
                    <TableCell padding="checkbox" sx={{ pr: 1 }}>
                      <RowMenu
                        instructor={instructor}
                        isSelf={instructor.id === myId}
                        onEdit={openEdit}
                        onInvite={(i) => void sendInvite(i)}
                        onRemove={setRemoveTarget}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Add / edit dialog ── */}
      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.name ?? editing.email}` : 'Add instructor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {!editing && (
              <Typography variant="body2" color="text.secondary">
                They get an email to set their password. If a customer already uses this email, that
                account is promoted so their history comes with them.
              </Typography>
            )}
            <TextField
              label="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <TextField
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <FormControl>
              <InputLabel id="access-label">Access</InputLabel>
              <Select
                labelId="access-label"
                label="Access"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'STAFF' | 'ADMIN' }))}
                disabled={editing !== null && editing.id === myId}
              >
                <MenuItem value="STAFF">Staff — what their studio role allows</MenuItem>
                <MenuItem value="ADMIN">Admin — everything, every studio</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Studios</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Pick a role at each studio they work at. They can be scheduled and use the register
                only at those studios.
              </Typography>
              <Stack spacing={1.5}>
                {locations.map((loc) => {
                  const options = rolesByLocation.get(loc.id) ?? [];
                  const value = form.roles[loc.id] ?? NO_ROLE;
                  const chosen = options.find((r) => r.id === value);
                  return (
                    <Stack key={loc.id} direction="row" sx={{ alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 72, fontWeight: 500 }}>{loc.name}</Typography>
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel id={`role-${loc.id}`}>Role</InputLabel>
                        <Select
                          labelId={`role-${loc.id}`}
                          label="Role"
                          value={value}
                          onChange={(e) => setForm((f) => ({ ...f, roles: { ...f.roles, [loc.id]: e.target.value } }))}
                        >
                          <MenuItem value={NO_ROLE}>
                            <em>Not at this studio</em>
                          </MenuItem>
                          {options.map((r) => (
                            <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                          ))}
                        </Select>
                        {chosen && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Can see: {describePermissions(chosen)}
                          </Typography>
                        )}
                        {options.length === 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            No roles at {loc.name} yet — create one under Roles &amp; Permissions.
                          </Typography>
                        )}
                      </FormControl>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            {!editing && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.sendInvite}
                    onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                  />
                }
                label="Email them a link to set their password now"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Add instructor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove confirmation ── */}
      <Dialog open={removeTarget !== null} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove from the team?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{removeTarget?.name ?? removeTarget?.email}</strong> becomes a customer again: no
            admin access, no studio roles. Their account, classes they taught and pay history stay.
            This can be undone by adding them again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => removeTarget && void remove(removeTarget)}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack !== null}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
