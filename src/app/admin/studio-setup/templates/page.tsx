'use client';

import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
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
import DownloadingIcon from '@mui/icons-material/Downloading';
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

interface FormState {
  name: string;
  description: string;
  trigger: string;
  subject: string;
  body: string;
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
  { value: 'instructors', label: 'Sent to instructors' },
  { value: 'reminders', label: 'Reminders' },
];

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  trigger: '',
  subject: '',
  body: '',
  isActive: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesFilter(t: Template, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'appointments') return t.trigger.includes('appointment');
  if (filter === 'memberships') return t.trigger.includes('membership');
  if (filter === 'instructors') return t.trigger.includes('instructor');
  if (filter === 'reminders') return t.trigger.includes('reminder');
  return true;
}

function smsStats(text: string): { chars: number; segments: number } {
  const len = text.length;
  if (len === 0) return { chars: 0, segments: 0 };
  return { chars: len, segments: len <= 160 ? 1 : Math.ceil(len / 153) };
}

function toForm(t: Template): FormState {
  return {
    name: t.name,
    description: t.description ?? '',
    trigger: t.trigger,
    subject: t.subject ?? '',
    body: t.body,
    isActive: t.isActive,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RowMenuProps {
  template: Template;
  onEdit: () => void;
  onTestSend: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function RowMenu({ template, onEdit, onTestSend, onToggleActive, onDelete }: RowMenuProps) {
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
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { elevation: 3, sx: { minWidth: 180, borderRadius: 2 } } }}
      >
        <MenuItem onClick={() => { setAnchor(null); onEdit(); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onTestSend(); }}>Send test</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onToggleActive(); }}>
          {template.isActive ? 'Deactivate' : 'Activate'}
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [channelTab, setChannelTab] = useState<'email' | 'sms'>('email');
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');

  // Edit / create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  // Test-send dialog
  const [testTarget, setTestTarget] = useState<Template | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Snackbar
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/templates');
    if (res.ok) setTemplates(await res.json() as Template[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  // ── Computed list ────────────────────────────────────────────────────────

  const filters = channelTab === 'email' ? EMAIL_FILTERS : SMS_FILTERS;
  const vars = channelTab === 'email' ? EMAIL_VARS : SMS_VARS;

  const displayed = templates
    .filter((t) => t.channel === channelTab)
    .filter((t) => matchesFilter(t, filterTab))
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.trigger.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    });

  // ── Seed defaults ────────────────────────────────────────────────────────

  async function handleSeedDefaults() {
    setSeeding(true);
    const res = await fetch('/api/admin/templates/seed-defaults', { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { created: number; skipped: number };
      setSnack({ msg: `Loaded ${data.created} new template${data.created !== 1 ? 's' : ''}${data.skipped > 0 ? `. ${data.skipped} already existed.` : '.'}`, severity: 'success' });
      await load();
    } else {
      setSnack({ msg: 'Failed to load defaults', severity: 'error' });
    }
    setSeeding(false);
  }

  // ── Edit / create ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, trigger: channelTab === 'sms' ? 'sms_' : '' });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(t: Template) {
    setEditTarget(t);
    setForm(toForm(t));
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required'); setSaving(false); return; }
    if (!form.trigger.trim()) { setFormError('Trigger is required'); setSaving(false); return; }
    if (!form.body.trim()) { setFormError('Body is required'); setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      trigger: form.trigger.trim(),
      channel: editTarget ? editTarget.channel : channelTab,
      subject: form.subject.trim() || undefined,
      body: form.body.trim(),
      isActive: form.isActive,
    };

    const url = editTarget ? `/api/admin/templates/${editTarget.id}` : '/api/admin/templates';
    const method = editTarget ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setFormError(data.error ?? 'Save failed');
    } else {
      setDialogOpen(false);
      setSnack({ msg: editTarget ? 'Template updated' : 'Template created', severity: 'success' });
      await load();
    }
    setSaving(false);
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggleActive(t: Template) {
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

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(t: Template) {
    setDeleteTarget(null);
    const res = await fetch(`/api/admin/templates/${t.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setSnack({ msg: 'Template deleted', severity: 'success' });
    } else {
      setSnack({ msg: 'Delete failed', severity: 'error' });
    }
  }

  // ── Test send ─────────────────────────────────────────────────────────────

  async function handleTestSend() {
    if (!testTarget) return;
    setTestSending(true);
    setTestError(null);
    const res = await fetch(`/api/admin/templates/${testTarget.id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo.trim() }),
    });
    if (res.ok) {
      setTestTarget(null);
      setTestTo('');
      setSnack({ msg: 'Test sent!', severity: 'success' });
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setTestError(data.error ?? 'Send failed');
    }
    setTestSending(false);
  }

  // ── Variable insertion ────────────────────────────────────────────────────

  function insertVariable(varName: string) {
    const el = bodyRef.current;
    const snippet = `{{${varName}}}`;
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + snippet }));
      return;
    }
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    const before = form.body.slice(0, start);
    const after = form.body.slice(end);
    const newBody = before + snippet + after;
    setForm((f) => ({ ...f, body: newBody }));
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  // ── Channel tab change ────────────────────────────────────────────────────

  function handleChannelChange(_: React.SyntheticEvent, val: string) {
    setChannelTab(val as 'email' | 'sms');
    setFilterTab('all');
    setSearch('');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const channelTemplates = templates.filter((t) => t.channel === channelTab);
  const activeCount = channelTemplates.filter((t) => t.isActive).length;
  const stats = channelTab === 'sms' ? smsStats(form.body) : null;

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
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={seeding ? <CircularProgress size={14} /> : <DownloadingIcon />}
            onClick={handleSeedDefaults}
            disabled={seeding}
          >
            Load defaults
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
            New template
          </Button>
        </Stack>
      </Box>

      {/* ── Channel tabs ── */}
      <Tabs
        value={channelTab}
        onChange={handleChannelChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab value="email" label="Email" />
        <Tab value="sms" label="SMS" />
      </Tabs>

      {/* ── Filter chips + search ── */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              size="small"
              onClick={() => setFilterTab(f.value)}
              variant={filterTab === f.value ? 'filled' : 'outlined'}
              color={filterTab === f.value ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
        <TextField
          size="small"
          placeholder="Search templates…"
          value={search}
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
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>Name</TableCell>
                <TableCell>Trigger</TableCell>
                {channelTab === 'email' && <TableCell>Subject</TableCell>}
                {channelTab === 'sms' && <TableCell>Preview</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary" variant="body2">
                      {templates.filter((t) => t.channel === channelTab).length === 0
                        ? 'No templates yet — click "Load defaults" to get started.'
                        : 'No templates match your search.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map((t) => (
                  <TableRow
                    key={t.id}
                    hover
                    onClick={() => openEdit(t)}
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
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {t.trigger}
                      </Typography>
                    </TableCell>
                    {channelTab === 'email' && (
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                          {t.subject ?? <em>No subject</em>}
                        </Typography>
                      </TableCell>
                    )}
                    {channelTab === 'sms' && (
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                          {t.body.slice(0, 80)}{t.body.length > 80 ? '…' : ''}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        label={t.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={t.isActive ? 'success' : 'default'}
                        variant={t.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        template={t}
                        onEdit={() => openEdit(t)}
                        onTestSend={() => { setTestTarget(t); setTestTo(''); setTestError(null); }}
                        onToggleActive={() => handleToggleActive(t)}
                        onDelete={() => setDeleteTarget(t)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Footer */}
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {channelTemplates.length} template{channelTemplates.length !== 1 ? 's' : ''} · {activeCount} active
            </Typography>
          </Box>
        </TableContainer>
      )}

      {/* ── Edit / Create dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {editTarget ? 'Edit template' : `New ${channelTab.toUpperCase()} template`}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Grid container spacing={3}>

            {/* Left: metadata */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2.5}>
                {formError && <Alert severity="error" onClose={() => setFormError(null)}>{formError}</Alert>}
                <TextField
                  label="Template name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Appointment confirmation (in-person)"
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="When is this sent? (optional)"
                  fullWidth
                />
                <TextField
                  label="Trigger"
                  required
                  value={form.trigger}
                  onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                  placeholder={channelTab === 'sms' ? 'sms_appointment_reminder_inperson' : 'appointment_confirmation_inperson'}
                  helperText="Unique identifier used by your code to send this template"
                  fullWidth
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                />
                {(editTarget ? editTarget.channel : channelTab) === 'email' && (
                  <TextField
                    label="Subject line"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g. You're booked! — {{studio_name}}"
                    fullWidth
                  />
                )}
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Stack>
            </Grid>

            {/* Right: variable chips + body */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
                    Insert variable
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {vars.map((v) => (
                      <Tooltip key={v} title={`Click to insert {{${v}}}`} placement="top">
                        <Chip
                          label={`{{${v}}}`}
                          size="small"
                          onClick={() => insertVariable(v)}
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>

                <TextField
                  label="Body"
                  required
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  multiline
                  rows={(editTarget?.channel ?? channelTab) === 'sms' ? 6 : 12}
                  fullWidth
                  inputRef={bodyRef}
                  placeholder={
                    (editTarget?.channel ?? channelTab) === 'sms'
                      ? 'Hi {{customer_name}}, reminder: your {{appointment_type}} at {{studio_name}} is tomorrow, {{appointment_date}} at {{appointment_time}}. See you soon!'
                      : `Hi {{customer_name}},\n\nYour appointment at {{studio_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.\n\nSee you soon,\n{{studio_name}}`
                  }
                  slotProps={{
                    htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 } },
                  }}
                />

                {/* SMS character counter */}
                {(editTarget?.channel ?? channelTab) === 'sms' && stats && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Typography variant="caption" color={stats.chars > 320 ? 'error' : 'text.secondary'}>
                      {stats.chars} chars
                    </Typography>
                    <Typography variant="caption" color={stats.segments > 2 ? 'warning.main' : 'text.secondary'}>
                      {stats.segments === 0 ? '—' : `${stats.segments} segment${stats.segments !== 1 ? 's' : ''}`}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {editTarget && (
            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={() => {
                setDialogOpen(false);
                setTestTarget(editTarget);
                setTestTo('');
                setTestError(null);
              }}
              sx={{ mr: 'auto' }}
            >
              Test send
            </Button>
          )}
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Test-send dialog ── */}
      <Dialog
        open={testTarget !== null}
        onClose={() => { setTestTarget(null); setTestTo(''); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Send test: {testTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {testError && <Alert severity="error">{testError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Variables will be filled with sample data. The message will be sent exactly as shown.
            </Typography>
            <TextField
              label={testTarget?.channel === 'sms' ? 'Phone number (E.164)' : 'Email address'}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={testTarget?.channel === 'sms' ? '+13035550100' : 'you@example.com'}
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setTestTarget(null); setTestTo(''); }} disabled={testSending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={testSending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
            onClick={handleTestSend}
            disabled={testSending || !testTo.trim()}
          >
            {testSending ? 'Sending…' : 'Send test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
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
