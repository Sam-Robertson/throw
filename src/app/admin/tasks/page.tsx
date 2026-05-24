'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextLink from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';

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
import Drawer from '@mui/material/Drawer';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import { TaskForm, type TaskFormValues } from './_components/TaskForm';
import { md3 } from '@/lib/theme';

const TZ = 'America/Denver';

type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  triggerType: 'MANUAL' | 'AUTOMATION';
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignedToId: string | null;
  linkedCustomerId: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  linkedCustomer: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null; email: string };
}

interface StaffUser { id: string; name: string | null; email: string; }

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

type StatusColor = 'default' | 'primary' | 'success' | 'error' | 'warning';
const STATUS_COLOR: Record<TaskStatus, StatusColor> = {
  OPEN: 'default',
  IN_PROGRESS: 'primary',
  DONE: 'success',
  CANCELLED: 'error',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

function isOverdue(task: StaffTask) {
  if (!task.dueAt || task.status === 'DONE' || task.status === 'CANCELLED') return false;
  return new Date(task.dueAt) < new Date();
}

function initials(name: string | null, email: string) {
  if (name) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
  }
  return email[0].toUpperCase();
}

function dueDateLabel(iso: string) {
  const d = new Date(iso);
  const past = d < new Date();
  const rel = formatDistanceToNow(d, { addSuffix: true });
  const abs = formatInTimeZone(d, TZ, 'MMM d, yyyy');
  return { rel, abs, past };
}

// ── Row overflow menu ─────────────────────────────────────────────────────
function RowMenu({ task, isAdmin, onEdit, onDelete, onStatusChange }: {
  task: StaffTask;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }} sx={{ color: 'text.secondary' }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2 } } }}
        onClick={(e) => e.stopPropagation()}
      >
        {isAdmin && (
          <MenuItem onClick={() => { setAnchor(null); onEdit(); }} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            Edit task
          </MenuItem>
        )}
        {task.status === 'OPEN' && (
          <MenuItem onClick={() => { setAnchor(null); onStatusChange(task.id, 'IN_PROGRESS'); }} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon><PlayArrowOutlinedIcon fontSize="small" /></ListItemIcon>
            Start task
          </MenuItem>
        )}
        {(task.status === 'OPEN' || task.status === 'IN_PROGRESS') && (
          <MenuItem onClick={() => { setAnchor(null); onStatusChange(task.id, 'DONE'); }} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon><CheckCircleOutlinedIcon fontSize="small" /></ListItemIcon>
            Mark complete
          </MenuItem>
        )}
        {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
          <MenuItem onClick={() => { setAnchor(null); onStatusChange(task.id, 'CANCELLED'); }} sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            <ListItemIcon><CloseIcon fontSize="small" sx={{ color: 'text.secondary' }} /></ListItemIcon>
            Cancel task
          </MenuItem>
        )}
        {isAdmin && [
          <Divider key="d" />,
          <MenuItem key="del" onClick={() => { setAnchor(null); onDelete(); }} sx={{ fontSize: '0.875rem', color: 'error.main' }}>
            <ListItemIcon><DeleteOutlinedIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            Delete
          </MenuItem>,
        ]}
      </Menu>
    </>
  );
}

// ── Task detail drawer ────────────────────────────────────────────────────
function TaskDrawer({ task, isAdmin, actionLoading, onClose, onStatusChange, onEdit, onDelete }: {
  task: StaffTask | null;
  isAdmin: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!task) return null;
  const overdue = isOverdue(task);
  const due = task.dueAt ? dueDateLabel(task.dueAt) : null;

  return (
    <Drawer anchor="right" open={!!task} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: 0 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 1 }}>{task.title}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                label={STATUS_LABEL[task.status]}
                size="small"
                color={STATUS_COLOR[task.status]}
                variant={task.status === 'OPEN' ? 'outlined' : 'filled'}
              />
              {task.triggerType === 'AUTOMATION' && <Chip label="Automation" size="small" variant="outlined" />}
              {overdue && <Chip label="Overdue" size="small" color="error" icon={<WarningAmberRoundedIcon />} />}
            </Stack>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
          {/* Actions */}
          <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap' }}>
            {task.status === 'OPEN' && (
              <Button size="small" variant="contained" startIcon={<PlayArrowOutlinedIcon />}
                onClick={() => onStatusChange(task.id, 'IN_PROGRESS')} disabled={actionLoading}>
                Start
              </Button>
            )}
            {(task.status === 'OPEN' || task.status === 'IN_PROGRESS') && (
              <Button size="small" variant="outlined" startIcon={<CheckCircleOutlinedIcon />}
                onClick={() => onStatusChange(task.id, 'DONE')} disabled={actionLoading}>
                Complete
              </Button>
            )}
            {task.status !== 'DONE' && task.status !== 'CANCELLED' && (
              <Button size="small" variant="text" color="inherit" sx={{ color: 'text.secondary' }}
                onClick={() => onStatusChange(task.id, 'CANCELLED')} disabled={actionLoading}>
                Cancel task
              </Button>
            )}
          </Stack>

          {/* Description */}
          {task.description && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Description
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {task.description}
              </Typography>
            </Box>
          )}

          {/* Meta grid */}
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Assigned to
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {task.assignedTo ? (task.assignedTo.name ?? task.assignedTo.email) : <Typography component="span" variant="body2" color="text.disabled">Unassigned</Typography>}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Customer
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {task.linkedCustomer
                  ? <Typography component={NextLink} href={`/admin/customers/${task.linkedCustomer.id}`} variant="body2" sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {task.linkedCustomer.name ?? task.linkedCustomer.email}
                    </Typography>
                  : <Typography component="span" variant="body2" color="text.disabled">—</Typography>}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Due date
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: due?.past && !['DONE','CANCELLED'].includes(task.status) ? 'error.main' : 'text.primary' }}>
                {due ? `${due.abs} (${due.rel})` : <Typography component="span" variant="body2" color="text.disabled">—</Typography>}
              </Typography>
            </Box>
            {task.completedAt && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Completed
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {formatInTimeZone(new Date(task.completedAt), TZ, 'MMM d, yyyy h:mm a')}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Created by
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {task.createdBy.name ?? task.createdBy.email}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Footer actions */}
        {isAdmin && (
          <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={onEdit}>Edit</Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlinedIcon />} onClick={onDelete}>Delete</Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drawer
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const drawerTask = tasks.find((t) => t.id === drawerTaskId) ?? null;

  async function loadStaff() {
    const res = await fetch('/api/admin/staff');
    if (res.ok) setStaffList(await res.json() as StaffUser[]);
  }

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (assigneeFilter === 'unassigned') params.set('assignedToId', 'unassigned');
    else if (assigneeFilter === 'me' && currentUserId) params.set('assignedToId', currentUserId);
    else if (assigneeFilter !== 'all') params.set('assignedToId', assigneeFilter);
    const res = await fetch(`/api/admin/tasks?${params}`);
    if (res.ok) setTasks(await res.json() as StaffTask[]);
    setLoading(false);
  }, [statusFilter, assigneeFilter, currentUserId]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data: { user?: { id?: string; role?: string } }) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
        if (data?.user?.role === 'ADMIN') setIsAdmin(true);
      });
    void loadStaff();
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tasks;
    return tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.linkedCustomer?.name?.toLowerCase().includes(q) ||
      t.linkedCustomer?.email?.toLowerCase().includes(q) ||
      t.assignedTo?.name?.toLowerCase().includes(q),
    );
  }, [tasks, search]);

  // Selection
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const someSelected = filtered.some((t) => selected.has(t.id)) && !allSelected;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((t) => next.delete(t.id));
      else filtered.forEach((t) => next.add(t.id));
      return next;
    });
  }
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    setActionLoading(true);
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated: StaffTask = await res.json();
      setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
    }
    setActionLoading(false);
  }

  async function handleFormSubmit(values: TaskFormValues) {
    setFormSaving(true); setFormError(null);
    const payload = {
      title: values.title,
      description: values.description || null,
      assignedToId: values.assignedToId || null,
      linkedCustomerId: values.linkedCustomerId || null,
      dueAt: values.dueAt || null,
      ...(editingTask && { status: values.status }),
    };
    const res = editingTask
      ? await fetch(`/api/admin/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setFormError(d.error ?? 'Something went wrong'); setFormSaving(false); return;
    }
    const saved: StaffTask = await res.json();
    if (editingTask) setTasks((prev) => prev.map((t) => t.id === saved.id ? saved : t));
    else { setTasks((prev) => [saved, ...prev]); setDrawerTaskId(saved.id); }
    setFormOpen(false); setEditingTask(null); setFormSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/tasks/${deleteId}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== deleteId));
      if (drawerTaskId === deleteId) setDrawerTaskId(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteId); return n; });
    }
    setDeleteId(null); setDeleting(false);
  }

  function openNew() { setEditingTask(null); setFormError(null); setFormOpen(true); }
  function openEdit(task: StaffTask) { setEditingTask(task); setFormError(null); setFormOpen(true); }

  const activeFilterCount = [statusFilter !== 'OPEN', assigneeFilter !== 'all'].filter(Boolean).length;

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>Staff tasks</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Add task
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Filter toolbar ── */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ alignItems: { sm: 'center' }, px: 2, py: 1.5, gap: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}
        >
          {/* Status pills */}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', flex: 1 }}>
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s;
              return (
                <Chip
                  key={s}
                  label={s === 'IN_PROGRESS' ? 'In progress' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  size="small"
                  onClick={() => setStatusFilter(s)}
                  variant={active ? 'filled' : 'outlined'}
                  color={active ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: '0.75rem' }}
                />
              );
            })}
          </Stack>

          {/* Assignee filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="assignee-filter-label">Assignee</InputLabel>
            <Select
              labelId="assignee-filter-label"
              value={assigneeFilter}
              label="Assignee"
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <MenuItem value="all">All staff</MenuItem>
              <MenuItem value="me">Me</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
              {staffList.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name ?? s.email}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} /></InputAdornment>,
              },
            }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
        </Stack>

        {/* ── Table ── */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}>
                  <Checkbox size="small" checked={allSelected} indeterminate={someSelected} onChange={toggleAll} disabled={filtered.length === 0} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 160 }}>Staff</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Task</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 200 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 160 }}>Customer / Lead</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 140 }}>Due at</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CheckCircleOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search ? 'No tasks match your search' : 'No tasks'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((task) => {
                  const overdue = isOverdue(task);
                  const isSelected = selected.has(task.id);
                  const isDrawerOpen = drawerTaskId === task.id;
                  const due = task.dueAt ? dueDateLabel(task.dueAt) : null;

                  return (
                    <TableRow
                      key={task.id}
                      selected={isSelected}
                      hover
                      onClick={() => setDrawerTaskId(isDrawerOpen ? null : task.id)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isDrawerOpen ? `${md3.primaryContainer}44` : undefined,
                      }}
                    >
                      <TableCell padding="checkbox" sx={{ pl: 2 }} onClick={(e) => e.stopPropagation()}>
                        <Checkbox size="small" checked={isSelected} onChange={() => toggleRow(task.id)} />
                      </TableCell>

                      {/* Staff */}
                      <TableCell>
                        {task.assignedTo ? (
                          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0 }}>
                              {initials(task.assignedTo.name, task.assignedTo.email)}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }} noWrap>
                              {task.assignedTo.name ?? task.assignedTo.email}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8125rem' }}>Unassigned</Typography>
                        )}
                      </TableCell>

                      {/* Task */}
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{task.title}</Typography>
                          <Chip
                            label={STATUS_LABEL[task.status]}
                            size="small"
                            color={STATUS_COLOR[task.status]}
                            variant={task.status === 'OPEN' ? 'outlined' : 'filled'}
                            sx={{ width: 'fit-content', height: 18, fontSize: '0.65rem' }}
                          />
                        </Stack>
                      </TableCell>

                      {/* Description */}
                      <TableCell sx={{ maxWidth: 200 }}>
                        {task.description ? (
                          <Tooltip title={task.description} placement="top">
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontSize: '0.8125rem',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                lineHeight: 1.4,
                              }}
                            >
                              {task.description}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Customer */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {task.linkedCustomer ? (
                          <Typography
                            component={NextLink}
                            href={`/admin/customers/${task.linkedCustomer.id}`}
                            variant="body2"
                            sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
                          >
                            {task.linkedCustomer.name ?? task.linkedCustomer.email}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Due at */}
                      <TableCell>
                        {due ? (
                          <Stack spacing={0}>
                            <Typography
                              variant="body2"
                              sx={{ fontSize: '0.8125rem', fontWeight: 500, color: overdue ? 'error.main' : 'text.primary' }}
                            >
                              {due.abs}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: overdue ? 'error.main' : 'text.secondary', fontWeight: overdue ? 600 : 400 }}
                            >
                              {due.rel}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Row menu */}
                      <TableCell padding="checkbox" sx={{ pr: 1 }} onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          task={task}
                          isAdmin={isAdmin}
                          onEdit={() => openEdit(task)}
                          onDelete={() => setDeleteId(task.id)}
                          onStatusChange={handleStatusChange}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Detail drawer ── */}
      <TaskDrawer
        task={drawerTask}
        isAdmin={isAdmin}
        actionLoading={actionLoading}
        onClose={() => setDrawerTaskId(null)}
        onStatusChange={handleStatusChange}
        onEdit={() => { if (drawerTask) openEdit(drawerTask); }}
        onDelete={() => { if (drawerTask) { setDeleteId(drawerTask.id); setDrawerTaskId(null); } }}
      />

      {/* ── Add / Edit dialog ── */}
      <Dialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{editingTask ? 'Edit task' : 'New task'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TaskForm
            key={editingTask?.id ?? 'new'}
            initialValues={editingTask ? {
              title: editingTask.title,
              description: editingTask.description ?? '',
              assignedToId: editingTask.assignedToId ?? '',
              linkedCustomerId: editingTask.linkedCustomerId ?? '',
              linkedCustomerLabel: editingTask.linkedCustomer?.name ?? editingTask.linkedCustomer?.email ?? '',
              dueAt: editingTask.dueAt ? formatInTimeZone(new Date(editingTask.dueAt), TZ, "yyyy-MM-dd'T'HH:mm") : '',
              status: editingTask.status,
            } : undefined}
            isEdit={!!editingTask}
            staffList={staffList}
            saving={formSaving}
            error={formError}
            onSubmit={handleFormSubmit}
            onCancel={() => { setFormOpen(false); setEditingTask(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete task?</DialogTitle>
        <DialogContent><DialogContentText>This action cannot be undone.</DialogContentText></DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
