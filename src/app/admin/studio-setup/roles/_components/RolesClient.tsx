'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
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

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import type { PermissionKey } from '@/lib/permissions';

const NO_ROLE = '__none__';

const PERMISSION_DEFS: { key: PermissionKey; label: string }[] = [
  { key: 'canViewTips', label: 'View Tips' },
  { key: 'canViewMembershipReporting', label: 'Membership Reports' },
  { key: 'canViewBilling', label: 'View Billing' },
  { key: 'canManageSchedule', label: 'Manage Schedule' },
  { key: 'canCheckInMembers', label: 'Check-In Members' },
  { key: 'canManageTasks', label: 'Manage Tasks' },
  { key: 'canUsePos', label: 'Use Point of Sale' },
];

function emptyPermissions(): Record<PermissionKey, boolean> {
  return {
    canViewTips: false,
    canViewMembershipReporting: false,
    canViewBilling: false,
    canManageSchedule: false,
    canCheckInMembers: false,
    canManageTasks: false,
    canUsePos: false,
  };
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
  permissions: Partial<Record<PermissionKey, boolean>>;
  assignmentCount: number;
}

interface AssignmentRow {
  id: string;
  userId: string;
  locationId: string;
  userName: string | null;
  userEmail: string;
  userRole: 'STAFF' | 'ADMIN';
  staffRoleId: string;
  staffRoleName: string;
}

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  role: 'STAFF' | 'ADMIN';
}

interface RoleForm {
  id: string | null;
  name: string;
  permissions: Record<PermissionKey, boolean>;
}

export function RolesClient({ isAdmin }: { isAdmin: boolean }) {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [roles, setRoles] = useState<StaffRoleRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm>({ id: null, name: '', permissions: emptyPermissions() });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<StaffRoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    const res = await fetch('/api/admin/locations');
    if (!res.ok) return;
    const data = (await res.json()) as LocationRow[];
    setLocations(data);
    setLocationId((prev) => {
      if (prev) return prev;
      const firstActive = data.find((l) => l.isActive);
      return (firstActive ?? data[0])?.id ?? '';
    });
  }, []);

  const loadStaffUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) setStaffUsers((await res.json()) as StaffUser[]);
  }, []);

  const loadRolesAndAssignments = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    const [rolesRes, assignRes] = await Promise.all([
      fetch(`/api/admin/staff-roles?locationId=${locationId}`),
      fetch(`/api/admin/staff-assignments?locationId=${locationId}`),
    ]);
    if (rolesRes.ok) setRoles((await rolesRes.json()) as StaffRoleRow[]);
    if (assignRes.ok) setAssignments((await assignRes.json()) as AssignmentRow[]);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { void loadLocations(); }, [loadLocations]);
  useEffect(() => { void loadStaffUsers(); }, [loadStaffUsers]);
  useEffect(() => { void loadRolesAndAssignments(); }, [loadRolesAndAssignments]);

  const assignmentByUserId = useMemo(
    () => new Map(assignments.map((a) => [a.userId, a])),
    [assignments],
  );

  // ── Role dialog handlers ──────────────────────────────────────────────────
  function openCreateDialog() {
    setRoleForm({ id: null, name: '', permissions: emptyPermissions() });
    setRoleFormError(null);
    setRoleDialogOpen(true);
  }

  function openEditDialog(role: StaffRoleRow) {
    setRoleForm({
      id: role.id,
      name: role.name,
      permissions: { ...emptyPermissions(), ...role.permissions },
    });
    setRoleFormError(null);
    setRoleDialogOpen(true);
  }

  async function saveRole() {
    if (!roleForm.name.trim()) {
      setRoleFormError('Name is required');
      return;
    }
    setRoleSaving(true);
    setRoleFormError(null);
    const isEdit = roleForm.id !== null;
    const res = await fetch(
      isEdit ? `/api/admin/staff-roles/${roleForm.id}` : '/api/admin/staff-roles',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { name: roleForm.name.trim(), permissions: roleForm.permissions }
            : { name: roleForm.name.trim(), locationId, permissions: roleForm.permissions },
        ),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setRoleFormError(data.error ?? 'Failed to save role');
    } else {
      setRoleDialogOpen(false);
      setSnack({ msg: isEdit ? 'Role updated' : 'Role created', severity: 'success' });
      await loadRolesAndAssignments();
    }
    setRoleSaving(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/staff-roles/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeleteError(data.error ?? 'Failed to delete role');
    } else {
      setDeleteTarget(null);
      setDeleteError(null);
      setSnack({ msg: 'Role deleted', severity: 'success' });
      await loadRolesAndAssignments();
    }
  }

  async function handleAssignmentChange(userId: string, value: string) {
    if (value === NO_ROLE) {
      await fetch('/api/admin/staff-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, locationId }),
      });
      setSnack({ msg: 'Role removed', severity: 'success' });
    } else {
      await fetch('/api/admin/staff-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, staffRoleId: value, locationId }),
      });
      setSnack({ msg: 'Role assigned', severity: 'success' });
    }
    await loadRolesAndAssignments();
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Roles &amp; Permissions</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage what staff can see and do once they&apos;re in the admin area.
          </Typography>
        </Box>

        {locations.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="location-label">Location</InputLabel>
            <Select
              labelId="location-label"
              label="Location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      {/* ── Section 1: Roles ── */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', mb: 4 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600 }}>Roles</Typography>
          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateDialog}>
              New Role
            </Button>
          )}
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Staff Assigned</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Permissions</TableCell>
                {isAdmin && <TableCell padding="checkbox" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      No roles at this location yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{role.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {role.assignmentCount} {role.assignmentCount === 1 ? 'person' : 'people'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {PERMISSION_DEFS.map((p) => (
                          <Chip
                            key={p.key}
                            label={p.label}
                            size="small"
                            color={role.permissions[p.key] ? 'success' : 'default'}
                            variant={role.permissions[p.key] ? 'filled' : 'outlined'}
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    {isAdmin && (
                      <TableCell padding="checkbox" sx={{ pr: 1, whiteSpace: 'nowrap' }}>
                        <IconButton size="small" onClick={() => openEditDialog(role)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => { setDeleteTarget(role); setDeleteError(null); }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Section 2: Assignments ── */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>Assignments</Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Account Type</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Role at this Location</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>No staff or admin users yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                staffUsers.map((u) => {
                  const assignment = assignmentByUserId.get(u.id);
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.role === 'ADMIN' ? 'Admin' : 'Staff'}
                          size="small"
                          color={u.role === 'ADMIN' ? 'primary' : 'default'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Select
                              size="small"
                              value={assignment?.staffRoleId ?? NO_ROLE}
                              onChange={(e) => void handleAssignmentChange(u.id, e.target.value)}
                              sx={{ minWidth: 180 }}
                              disabled={!locationId}
                            >
                              <MenuItem value={NO_ROLE}>No role</MenuItem>
                              {roles.map((r) => (
                                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                              ))}
                            </Select>
                            {u.role === 'ADMIN' && (
                              <Typography variant="caption" color="text.secondary">
                                Admins bypass all permission checks.
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color={assignment ? 'text.primary' : 'text.disabled'}>
                            {assignment?.staffRoleName ?? 'No role assigned'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Role create/edit dialog ── */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{roleForm.id ? 'Edit role' : 'New role'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {roleFormError && <Alert severity="error">{roleFormError}</Alert>}
            <TextField
              label="Role name"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              fullWidth
              autoFocus
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Permissions</Typography>
              <Stack spacing={0.5}>
                {PERMISSION_DEFS.map((p) => (
                  <FormControlLabel
                    key={p.key}
                    control={
                      <Switch
                        checked={roleForm.permissions[p.key]}
                        onChange={(e) =>
                          setRoleForm({
                            ...roleForm,
                            permissions: { ...roleForm.permissions, [p.key]: e.target.checked },
                          })
                        }
                      />
                    }
                    label={<Typography variant="body2">{p.label}</Typography>}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRoleDialogOpen(false)} disabled={roleSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveRole} disabled={roleSaving}>
            {roleSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete role?</DialogTitle>
        <DialogContent>
          {deleteError ? (
            <Alert severity="error">{deleteError}</Alert>
          ) : (
            <DialogContentText>
              <strong>{deleteTarget?.name}</strong> will be permanently deleted. This can&apos;t be undone.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Link back from context ── */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Manage who has Staff access at all on the{' '}
          <NextLink href="/admin/studio-setup/instructors" style={{ textDecoration: 'underline' }}>
            Instructors
          </NextLink>{' '}
          page.
        </Typography>
      </Box>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ minWidth: 280 }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
