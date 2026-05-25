'use client';

import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadingIcon from '@mui/icons-material/Downloading';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  channel: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
}

interface SmsAutomation {
  id: string;
  name: string;
  triggerEvent: string;
  delayMinutes: number;
  messageTemplate: string;
  isActive: boolean;
}

interface SmsLog {
  id: string;
  toPhone: string;
  message: string;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

// Unified row rendered in the SMS table
type SmsRow =
  | ({ kind: 'template' } & Template)
  | ({ kind: 'automation' } & SmsAutomation);

interface TemplateFormState {
  name: string;
  description: string;
  trigger: string;
  subject: string;
  body: string;
  isActive: boolean;
}

interface AutoFormState {
  name: string;
  triggerEvent: string;
  delayMinutes: string;
  messageTemplate: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_VARS = [
  'customer_name', 'customer_email', 'instructor_name',
  'appointment_date', 'appointment_time', 'appointment_type',
  'studio_name', 'studio_address', 'studio_phone',
  'payment_link', 'penalty_amount', 'cancellation_reason',
];

const SMS_VARS = [
  'customer_name', 'instructor_name',
  'appointment_date', 'appointment_time', 'appointment_type',
  'studio_name', 'studio_phone',
];

const EMAIL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'memberships', label: 'Memberships' },
];

const SMS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'memberships', label: 'Memberships' },
  { value: 'instructors', label: 'Sent to instructors' },
  { value: 'reminders', label: 'Reminders' },
];

const AUTOMATION_TRIGGERS = [
  { value: 'booking/confirmed', label: 'Booking confirmed' },
  { value: 'booking/reminder', label: 'Booking reminder' },
  { value: 'booking/cancelled', label: 'Booking cancelled' },
  { value: 'membership/created', label: 'New member joined' },
  { value: 'membership/paused', label: 'Membership paused' },
];

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: '', description: '', trigger: '', subject: '', body: '', isActive: true,
};

const EMPTY_AUTO_FORM: AutoFormState = {
  name: '', triggerEvent: 'booking/confirmed', delayMinutes: '0',
  messageTemplate: '', isActive: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesEmailFilter(t: Template, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'appointments') return t.trigger.includes('appointment');
  if (filter === 'memberships') return t.trigger.includes('membership');
  return true;
}

function matchesSmsFilter(row: SmsRow, filter: string): boolean {
  const trigger = row.kind === 'template' ? row.trigger : row.triggerEvent;
  if (filter === 'all') return true;
  if (filter === 'appointments') return trigger.includes('appointment') || trigger.includes('booking');
  if (filter === 'memberships') return trigger.includes('membership');
  if (filter === 'instructors') return trigger.includes('instructor');
  if (filter === 'reminders') return trigger.includes('reminder');
  return true;
}

function smsStats(text: string): { chars: number; segments: number } {
  const len = text.length;
  if (len === 0) return { chars: 0, segments: 0 };
  return { chars: len, segments: len <= 160 ? 1 : Math.ceil(len / 153) };
}

function fmtDelay(mins: number): string {
  if (mins === 0) return 'Immediate';
  if (mins < 60) return `+${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `+${h}h` : `+${h}h ${m}m`;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return `****${phone.slice(-4)}`;
}

function toTemplateForm(t: Template): TemplateFormState {
  return {
    name: t.name, description: t.description ?? '',
    trigger: t.trigger, subject: t.subject ?? '',
    body: t.body, isActive: t.isActive,
  };
}

function toAutoForm(a: SmsAutomation): AutoFormState {
  return {
    name: a.name, triggerEvent: a.triggerEvent,
    delayMinutes: String(a.delayMinutes),
    messageTemplate: a.messageTemplate, isActive: a.isActive,
  };
}

// ---------------------------------------------------------------------------
// RowMenu sub-component (shared by both kinds)
// ---------------------------------------------------------------------------

interface RowMenuProps {
  isActive: boolean;
  onEdit: () => void;
  onTestSend: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function RowMenu({ isActive, onEdit, onTestSend, onToggleActive, onDelete }: RowMenuProps) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        aria-label="row actions"
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor} open={open} onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { elevation: 3, sx: { minWidth: 180, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => { setAnchor(null); onEdit(); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onTestSend(); }}>Send test</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onToggleActive(); }}>
          {isActive ? 'Deactivate' : 'Activate'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onDelete(); }} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  // ── Data ─────────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [automations, setAutomations] = useState<SmsAutomation[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [channelTab, setChannelTab] = useState<'email' | 'sms'>('email');
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // ── Template dialog ───────────────────────────────────────────────────────
  const [tplDialogOpen, setTplDialogOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [tplForm, setTplForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── Automation dialog ─────────────────────────────────────────────────────
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [editAuto, setEditAuto] = useState<SmsAutomation | null>(null);
  const [autoForm, setAutoForm] = useState<AutoFormState>(EMPTY_AUTO_FORM);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const autoBodyRef = useRef<HTMLTextAreaElement>(null);

  // ── Delete dialog ─────────────────────────────────────────────────────────
  const [deleteRow, setDeleteRow] = useState<{ kind: 'template' | 'automation'; id: string; name: string } | null>(null);

  // ── Test-send dialog ──────────────────────────────────────────────────────
  const [testRow, setTestRow] = useState<{ kind: 'template' | 'automation'; id: string; name: string; isEmail: boolean } | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // ── Snackbar ──────────────────────────────────────────────────────────────
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true);
    const [tplRes, autoRes] = await Promise.all([
      fetch('/api/admin/templates'),
      fetch('/api/admin/automations'),
    ]);
    if (tplRes.ok) setTemplates(await tplRes.json() as Template[]);
    if (autoRes.ok) setAutomations(await autoRes.json() as SmsAutomation[]);
    setLoading(false);
  }

  async function loadLogs() {
    if (logsLoaded) return;
    const res = await fetch('/api/admin/sms-log');
    if (res.ok) setLogs((await res.json() as SmsLog[]).slice(0, 50));
    setLogsLoaded(true);
  }

  useEffect(() => { void loadAll(); }, []);

  // Open SMS log section
  function handleLogsToggle() {
    const next = !logsOpen;
    setLogsOpen(next);
    if (next && !logsLoaded) void loadLogs();
  }

  // ── Computed lists ────────────────────────────────────────────────────────

  const emailTemplates = templates
    .filter((t) => t.channel === 'email')
    .filter((t) => matchesEmailFilter(t, filterTab))
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.trigger.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
    });

  const smsRows: SmsRow[] = [
    ...templates.filter((t) => t.channel === 'sms').map((t): SmsRow => ({ kind: 'template', ...t })),
    ...automations.map((a): SmsRow => ({ kind: 'automation', ...a })),
  ];

  const filteredSmsRows = smsRows
    .filter((r) => matchesSmsFilter(r, filterTab))
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = r.name.toLowerCase();
      const trigger = (r.kind === 'template' ? r.trigger : r.triggerEvent).toLowerCase();
      const body = (r.kind === 'template' ? r.body : r.messageTemplate).toLowerCase();
      return name.includes(q) || trigger.includes(q) || body.includes(q);
    });

  // ── Channel / filter tab changes ──────────────────────────────────────────

  function handleChannelChange(_: React.SyntheticEvent, val: string) {
    setChannelTab(val as 'email' | 'sms');
    setFilterTab('all');
    setSearch('');
  }

  // ── Seed defaults ─────────────────────────────────────────────────────────

  async function handleSeedDefaults() {
    setSeeding(true);
    const res = await fetch('/api/admin/templates/seed-defaults', { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { created: number; skipped: number };
      setSnack({ msg: `Loaded ${data.created} new template${data.created !== 1 ? 's' : ''}${data.skipped > 0 ? `. ${data.skipped} already existed.` : '.'}`, severity: 'success' });
      await loadAll();
    } else {
      setSnack({ msg: 'Failed to load defaults', severity: 'error' });
    }
    setSeeding(false);
  }

  // ── Template CRUD ─────────────────────────────────────────────────────────

  function openCreateTemplate() {
    setEditTpl(null);
    setTplForm({ ...EMPTY_TEMPLATE_FORM, trigger: channelTab === 'sms' ? 'sms_' : '' });
    setTplError(null);
    setTplDialogOpen(true);
  }

  function openEditTemplate(t: Template) {
    setEditTpl(t);
    setTplForm(toTemplateForm(t));
    setTplError(null);
    setTplDialogOpen(true);
  }

  async function handleSaveTemplate() {
    setTplSaving(true);
    setTplError(null);
    if (!tplForm.name.trim()) { setTplError('Name is required'); setTplSaving(false); return; }
    if (!tplForm.trigger.trim()) { setTplError('Trigger is required'); setTplSaving(false); return; }
    if (!tplForm.body.trim()) { setTplError('Body is required'); setTplSaving(false); return; }

    const payload = {
      name: tplForm.name.trim(),
      description: tplForm.description.trim() || undefined,
      trigger: tplForm.trigger.trim(),
      channel: editTpl ? editTpl.channel : channelTab,
      subject: tplForm.subject.trim() || undefined,
      body: tplForm.body.trim(),
      isActive: tplForm.isActive,
    };

    const url = editTpl ? `/api/admin/templates/${editTpl.id}` : '/api/admin/templates';
    const res = await fetch(url, {
      method: editTpl ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setTplError(data.error ?? 'Save failed');
    } else {
      setTplDialogOpen(false);
      setSnack({ msg: editTpl ? 'Template updated' : 'Template created', severity: 'success' });
      await loadAll();
    }
    setTplSaving(false);
  }

  async function handleToggleTemplate(t: Template) {
    const res = await fetch(`/api/admin/templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) {
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, isActive: !x.isActive } : x));
    } else {
      setSnack({ msg: 'Update failed', severity: 'error' });
    }
  }

  // ── Automation CRUD ───────────────────────────────────────────────────────

  function openCreateAuto() {
    setEditAuto(null);
    setAutoForm(EMPTY_AUTO_FORM);
    setAutoError(null);
    setAutoDialogOpen(true);
  }

  function openEditAuto(a: SmsAutomation) {
    setEditAuto(a);
    setAutoForm(toAutoForm(a));
    setAutoError(null);
    setAutoDialogOpen(true);
  }

  async function handleSaveAuto() {
    setAutoSaving(true);
    setAutoError(null);
    if (!autoForm.name.trim()) { setAutoError('Name is required'); setAutoSaving(false); return; }
    if (!autoForm.messageTemplate.trim()) { setAutoError('Message is required'); setAutoSaving(false); return; }

    const payload = {
      name: autoForm.name.trim(),
      triggerEvent: autoForm.triggerEvent,
      delayMinutes: parseInt(autoForm.delayMinutes, 10) || 0,
      messageTemplate: autoForm.messageTemplate.trim(),
      isActive: autoForm.isActive,
    };

    const url = editAuto ? `/api/admin/automations/${editAuto.id}` : '/api/admin/automations';
    const res = await fetch(url, {
      method: editAuto ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setAutoError(data.error ?? 'Save failed');
    } else {
      setAutoDialogOpen(false);
      setSnack({ msg: editAuto ? 'Automation updated' : 'Automation created', severity: 'success' });
      await loadAll();
    }
    setAutoSaving(false);
  }

  async function handleToggleAuto(a: SmsAutomation) {
    const res = await fetch(`/api/admin/automations/${a.id}/toggle`, { method: 'PATCH' });
    if (res.ok) {
      setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, isActive: !x.isActive } : x));
    } else {
      setSnack({ msg: 'Update failed', severity: 'error' });
    }
  }

  // ── Shared delete ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteRow) return;
    const url = deleteRow.kind === 'template'
      ? `/api/admin/templates/${deleteRow.id}`
      : `/api/admin/automations/${deleteRow.id}`;
    setDeleteRow(null);
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) {
      if (deleteRow.kind === 'template') setTemplates((p) => p.filter((t) => t.id !== deleteRow.id));
      else setAutomations((p) => p.filter((a) => a.id !== deleteRow.id));
      setSnack({ msg: 'Deleted', severity: 'success' });
    } else {
      setSnack({ msg: 'Delete failed', severity: 'error' });
    }
  }

  // ── Test send ─────────────────────────────────────────────────────────────

  async function handleTestSend() {
    if (!testRow) return;
    setTestSending(true);
    setTestError(null);
    const url = testRow.kind === 'template'
      ? `/api/admin/templates/${testRow.id}/test`
      : `/api/admin/automations/${testRow.id}/test`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo.trim() }),
    });
    if (res.ok) {
      setTestRow(null);
      setTestTo('');
      setSnack({ msg: 'Test sent!', severity: 'success' });
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setTestError(data.error ?? 'Send failed');
    }
    setTestSending(false);
  }

  // ── Variable insertion ────────────────────────────────────────────────────

  function insertVariable(ref: React.RefObject<HTMLTextAreaElement | null>, field: 'body' | 'messageTemplate', snippet: string) {
    const el = ref.current;
    const setter = field === 'body' ? (v: string) => setTplForm((f) => ({ ...f, body: v })) : (v: string) => setAutoForm((f) => ({ ...f, messageTemplate: v }));
    const current = field === 'body' ? tplForm.body : autoForm.messageTemplate;

    if (!el) { setter(current + snippet); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? start;
    const next = current.slice(0, start) + snippet + current.slice(end);
    setter(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + snippet.length, start + snippet.length); }, 0);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const emailChannelTemplates = templates.filter((t) => t.channel === 'email');
  const emailActiveCount = emailChannelTemplates.filter((t) => t.isActive).length;
  const smsTemplateCount = templates.filter((t) => t.channel === 'sms').length;
  const smsActiveCount = templates.filter((t) => t.channel === 'sms' && t.isActive).length + automations.filter((a) => a.isActive).length;
  const smsTotal = smsRows.length;
  const autoStats = smsStats(autoForm.messageTemplate);
  const tplStats = smsStats(tplForm.body);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Transactional Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Email and SMS templates for automated notifications. Use{' '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>
              {'{{variable}}'}
            </code>{' '}
            for dynamic content.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 1 }}>
          <Button
            variant="outlined" size="small"
            startIcon={seeding ? <CircularProgress size={14} /> : <DownloadingIcon />}
            onClick={handleSeedDefaults} disabled={seeding}
          >
            Load defaults
          </Button>
          {channelTab === 'sms' && (
            <Button
              variant="outlined" size="small"
              startIcon={<AutoAwesomeIcon />}
              onClick={openCreateAuto}
            >
              New automation
            </Button>
          )}
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateTemplate}>
            New template
          </Button>
        </Stack>
      </Box>

      {/* ── Channel tabs ── */}
      <Tabs
        value={channelTab} onChange={handleChannelChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab value="email" label="Email" />
        <Tab value="sms" label="SMS" />
      </Tabs>

      {/* ── Filter chips + search ── */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {(channelTab === 'email' ? EMAIL_FILTERS : SMS_FILTERS).map((f) => (
            <Chip
              key={f.value} label={f.label} size="small"
              onClick={() => setFilterTab(f.value)}
              variant={filterTab === f.value ? 'filled' : 'outlined'}
              color={filterTab === f.value ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
        <TextField
          size="small" placeholder="Search…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ml: 'auto', minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* ── Table ── */}
      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>
      ) : channelTab === 'email' ? (

        /* ── EMAIL TABLE ── */
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>Name</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {emailTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary" variant="body2">
                      {emailChannelTemplates.length === 0 ? 'No email templates yet — click "Load defaults" to get started.' : 'No templates match your search.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                emailTemplates.map((t) => (
                  <TableRow key={t.id} hover onClick={() => openEditTemplate(t)}
                    sx={{ cursor: 'pointer', opacity: t.isActive ? 1 : 0.55 }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                      {t.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          {t.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{t.trigger}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                        {t.subject ?? <em>No subject</em>}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={t.isActive ? 'Active' : 'Inactive'} size="small" color={t.isActive ? 'success' : 'default'} variant={t.isActive ? 'filled' : 'outlined'} />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        isActive={t.isActive}
                        onEdit={() => openEditTemplate(t)}
                        onTestSend={() => { setTestRow({ kind: 'template', id: t.id, name: t.name, isEmail: true }); setTestTo(''); setTestError(null); }}
                        onToggleActive={() => handleToggleTemplate(t)}
                        onDelete={() => setDeleteRow({ kind: 'template', id: t.id, name: t.name })}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {emailChannelTemplates.length} template{emailChannelTemplates.length !== 1 ? 's' : ''} · {emailActiveCount} active
            </Typography>
          </Box>
        </TableContainer>

      ) : (

        /* ── SMS TABLE (templates + automations unified) ── */
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Trigger</TableCell>
                  <TableCell>Delay</TableCell>
                  <TableCell>Preview</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell width={40} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSmsRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary" variant="body2">
                        {smsRows.length === 0 ? 'No SMS templates yet — click "Load defaults" or "New automation" to get started.' : 'No templates match your search.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSmsRows.map((row) => {
                    const isTemplate = row.kind === 'template';
                    const trigger = isTemplate ? row.trigger : row.triggerEvent;
                    const body = isTemplate ? row.body : row.messageTemplate;
                    const delay = isTemplate ? null : row.delayMinutes;
                    return (
                      <TableRow
                        key={`${row.kind}-${row.id}`} hover
                        onClick={() => isTemplate ? openEditTemplate(row) : openEditAuto(row as SmsAutomation)}
                        sx={{ cursor: 'pointer', opacity: row.isActive ? 1 : 0.55 }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            {!isTemplate && (
                              <Tooltip title="SMS Automation">
                                <AutoAwesomeIcon sx={{ fontSize: 14, color: 'secondary.main', flexShrink: 0 }} />
                              </Tooltip>
                            )}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.name}</Typography>
                              {isTemplate && row.description && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                  {row.description}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                            {trigger}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {delay !== null ? (
                            <Chip label={fmtDelay(delay)} size="small" variant="outlined"
                              color={delay === 0 ? 'default' : 'info'} />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                            {body.slice(0, 80)}{body.length > 80 ? '…' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.isActive ? 'Active' : 'Inactive'} size="small" color={row.isActive ? 'success' : 'default'} variant={row.isActive ? 'filled' : 'outlined'} />
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            isActive={row.isActive}
                            onEdit={() => isTemplate ? openEditTemplate(row) : openEditAuto(row as SmsAutomation)}
                            onTestSend={() => { setTestRow({ kind: row.kind, id: row.id, name: row.name, isEmail: false }); setTestTo(''); setTestError(null); }}
                            onToggleActive={() => isTemplate ? handleToggleTemplate(row) : handleToggleAuto(row as SmsAutomation)}
                            onDelete={() => setDeleteRow({ kind: row.kind, id: row.id, name: row.name })}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {smsTotal} item{smsTotal !== 1 ? 's' : ''} ({smsTemplateCount} template{smsTemplateCount !== 1 ? 's' : ''}, {automations.length} automation{automations.length !== 1 ? 's' : ''}) · {smsActiveCount} active
              </Typography>
            </Box>
          </TableContainer>

          {/* ── Recent SMS Log (collapsible) ── */}
          <Box sx={{ mt: 3 }}>
            <Box
              onClick={handleLogsToggle}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Recent SMS Log
              </Typography>
              {logsOpen ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            </Box>
            <Collapse in={logsOpen} timeout="auto">
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                      <TableCell>To</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Sent at</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!logsLoaded ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <CircularProgress size={20} />
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">No messages sent yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{maskPhone(log.toPhone)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {log.user?.name ?? log.user?.email ?? '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                              {log.message.slice(0, 80)}{log.message.length > 80 ? '…' : ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={log.status} size="small"
                              color={log.status === 'sent' ? 'success' : log.status === 'skipped' ? 'default' : 'error'}
                              variant={log.status === 'sent' ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(log.createdAt).toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          TEMPLATE EDIT / CREATE DIALOG
      ───────────────────────────────────────────────────────────────────── */}
      <Dialog open={tplDialogOpen} onClose={() => setTplDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {editTpl ? 'Edit template' : `New ${channelTab.toUpperCase()} template`}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2.5}>
                {tplError && <Alert severity="error" onClose={() => setTplError(null)}>{tplError}</Alert>}
                <TextField label="Template name" required fullWidth value={tplForm.name}
                  onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
                <TextField label="Description" fullWidth value={tplForm.description}
                  onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })}
                  placeholder="When is this sent? (optional)" />
                <TextField label="Trigger" required fullWidth value={tplForm.trigger}
                  onChange={(e) => setTplForm({ ...tplForm, trigger: e.target.value })}
                  helperText="Unique identifier used by your code"
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
                {(editTpl ? editTpl.channel : channelTab) === 'email' && (
                  <TextField label="Subject line" fullWidth value={tplForm.subject}
                    onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })}
                    placeholder="e.g. You're booked! — {{studio_name}}" />
                )}
                <FormControlLabel
                  control={<Switch checked={tplForm.isActive} onChange={(e) => setTplForm({ ...tplForm, isActive: e.target.checked })} />}
                  label="Active"
                />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                    Insert variable
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {((editTpl ? editTpl.channel : channelTab) === 'email' ? EMAIL_VARS : SMS_VARS).map((v) => (
                      <Tooltip key={v} title={`Insert {{${v}}}`} placement="top">
                        <Chip label={`{{${v}}}`} size="small"
                          onClick={() => insertVariable(bodyRef, 'body', `{{${v}}}`)}
                          sx={{ fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer', '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } }} />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
                <TextField label="Body" required fullWidth multiline
                  rows={(editTpl?.channel ?? channelTab) === 'sms' ? 6 : 12}
                  value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
                  inputRef={bodyRef}
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 } } }}
                />
                {(editTpl?.channel ?? channelTab) === 'sms' && tplStats.chars > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Typography variant="caption" color={tplStats.chars > 320 ? 'error' : 'text.secondary'}>
                      {tplStats.chars} chars
                    </Typography>
                    <Typography variant="caption" color={tplStats.segments > 2 ? 'warning.main' : 'text.secondary'}>
                      {tplStats.segments} segment{tplStats.segments !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {editTpl && (
            <Button variant="outlined" startIcon={<SendIcon />}
              onClick={() => { setTplDialogOpen(false); setTestRow({ kind: 'template', id: editTpl.id, name: editTpl.name, isEmail: editTpl.channel === 'email' }); setTestTo(''); setTestError(null); }}
              sx={{ mr: 'auto' }}
            >
              Test send
            </Button>
          )}
          <Button variant="outlined" onClick={() => setTplDialogOpen(false)} disabled={tplSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTemplate} disabled={tplSaving}>
            {tplSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────
          AUTOMATION EDIT / CREATE DIALOG
      ───────────────────────────────────────────────────────────────────── */}
      <Dialog open={autoDialogOpen} onClose={() => setAutoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {editAuto ? 'Edit automation' : 'New SMS automation'}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2.5}>
                {autoError && <Alert severity="error" onClose={() => setAutoError(null)}>{autoError}</Alert>}
                <TextField label="Automation name" required fullWidth value={autoForm.name}
                  onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })}
                  placeholder="e.g. 24-Hour Booking Reminder" />
                <FormControl fullWidth required>
                  <InputLabel id="auto-trigger-label">Trigger event</InputLabel>
                  <Select labelId="auto-trigger-label" value={autoForm.triggerEvent} label="Trigger event"
                    onChange={(e) => setAutoForm({ ...autoForm, triggerEvent: e.target.value })}
                  >
                    {AUTOMATION_TRIGGERS.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Delay (minutes)" type="number" fullWidth value={autoForm.delayMinutes}
                  onChange={(e) => setAutoForm({ ...autoForm, delayMinutes: e.target.value })}
                  helperText={parseInt(autoForm.delayMinutes, 10) > 0 ? `Sends ${fmtDelay(parseInt(autoForm.delayMinutes, 10))} after trigger` : 'Sends immediately when triggered'}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
                <FormControlLabel
                  control={<Switch checked={autoForm.isActive} onChange={(e) => setAutoForm({ ...autoForm, isActive: e.target.checked })} />}
                  label="Active"
                />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                    Insert variable
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {SMS_VARS.map((v) => (
                      <Tooltip key={v} title={`Insert {{${v}}}`} placement="top">
                        <Chip label={`{{${v}}}`} size="small"
                          onClick={() => insertVariable(autoBodyRef, 'messageTemplate', `{{${v}}}`)}
                          sx={{ fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer', '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } }} />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
                <TextField label="Message" required fullWidth multiline rows={6}
                  value={autoForm.messageTemplate}
                  onChange={(e) => setAutoForm({ ...autoForm, messageTemplate: e.target.value })}
                  inputRef={autoBodyRef}
                  placeholder="Hi {{customer_name}}, reminder: your {{appointment_type}} at {{studio_name}} is tomorrow, {{appointment_date}} at {{appointment_time}}. See you soon!"
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 } } }}
                />
                {autoStats.chars > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Typography variant="caption" color={autoStats.chars > 320 ? 'error' : 'text.secondary'}>
                      {autoStats.chars} chars
                    </Typography>
                    <Typography variant="caption" color={autoStats.segments > 2 ? 'warning.main' : 'text.secondary'}>
                      {autoStats.segments} segment{autoStats.segments !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {editAuto && (
            <Button variant="outlined" startIcon={<SendIcon />}
              onClick={() => { setAutoDialogOpen(false); setTestRow({ kind: 'automation', id: editAuto.id, name: editAuto.name, isEmail: false }); setTestTo(''); setTestError(null); }}
              sx={{ mr: 'auto' }}
            >
              Test send
            </Button>
          )}
          <Button variant="outlined" onClick={() => setAutoDialogOpen(false)} disabled={autoSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAuto} disabled={autoSaving}>
            {autoSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Test-send dialog ── */}
      <Dialog open={testRow !== null} onClose={() => { setTestRow(null); setTestTo(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>Send test: {testRow?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {testError && <Alert severity="error">{testError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Variables will be filled with sample data. The message will be sent exactly as shown.
            </Typography>
            <TextField
              label={testRow?.isEmail ? 'Email address' : 'Phone number (E.164)'}
              value={testTo} onChange={(e) => setTestTo(e.target.value)}
              placeholder={testRow?.isEmail ? 'you@example.com' : '+13035550100'}
              fullWidth autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setTestRow(null); setTestTo(''); }} disabled={testSending}>Cancel</Button>
          <Button variant="contained"
            startIcon={testSending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
            onClick={handleTestSend} disabled={testSending || !testTo.trim()}
          >
            {testSending ? 'Sending…' : 'Send test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteRow !== null} onClose={() => setDeleteRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &ldquo;{deleteRow?.name}&rdquo;?</DialogTitle>
        <DialogContent><DialogContentText>This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteRow(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack !== null} autoHideDuration={4000} onClose={() => setSnack(null)}
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
