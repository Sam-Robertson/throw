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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
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
import Stack from '@mui/material/Stack';

interface Template {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

interface FormState {
  name: string;
  trigger: string;
  channel: string;
  subject: string;
  body: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  trigger: 'booking_confirmed',
  channel: 'email',
  subject: '',
  body: '',
  isActive: true,
};

const TRIGGERS = [
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'booking_cancelled', label: 'Booking Cancelled' },
  { value: 'booking_reminder', label: 'Booking Reminder' },
  { value: 'membership_renewed', label: 'Membership Renewed' },
  { value: 'membership_cancelled', label: 'Membership Cancelled' },
  { value: 'membership_paused', label: 'Membership Paused' },
  { value: 'membership_resumed', label: 'Membership Resumed' },
  { value: 'waiver_signed', label: 'Waiver Signed' },
  { value: 'waitlist_promoted', label: 'Moved Off Waitlist' },
];

function toForm(t: Template): FormState {
  return {
    name: t.name,
    trigger: t.trigger,
    channel: t.channel,
    subject: t.subject ?? '',
    body: t.body,
    isActive: t.isActive,
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/templates');
    if (res.ok) setTemplates(await res.json() as Template[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(t: Template) {
    setEditTarget(t);
    setForm(toForm(t));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    if (!form.name.trim() || !form.body.trim()) {
      setError('Name and body are required');
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      trigger: form.trigger,
      channel: form.channel,
      subject: form.subject.trim() || undefined,
      body: form.body.trim(),
      isActive: form.isActive,
    };

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/templates/${editTarget.id}` : '/api/admin/templates';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Save failed');
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(t: Template) {
    setDeleteTarget(null);
    await fetch(`/api/admin/templates/${t.id}`, { method: 'DELETE' });
    await load();
  }

  function triggerLabel(value: string) {
    return TRIGGERS.find((t) => t.value === value)?.label ?? value;
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Transactional Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Email and SMS templates for automated notifications. Use {'{{variable}}'} for dynamic content.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New Template</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No templates yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id} sx={{ cursor: 'pointer' }} onClick={() => openEdit(t)}>
                    <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{triggerLabel(t.trigger)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.channel === 'email' ? 'Email' : 'SMS'}
                        size="small"
                        variant="outlined"
                        color={t.channel === 'email' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={t.isActive ? 'success' : 'default'}
                        variant={t.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" color="error" onClick={() => setDeleteTarget(t)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Template' : 'New Template'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Template Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Booking Confirmation Email"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="trigger-label">Trigger Event</InputLabel>
                <Select
                  labelId="trigger-label"
                  value={form.trigger}
                  label="Trigger Event"
                  onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                >
                  {TRIGGERS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="channel-label">Channel</InputLabel>
                <Select
                  labelId="channel-label"
                  value={form.channel}
                  label="Channel"
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {form.channel === 'email' && (
              <TextField
                label="Subject Line"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Your booking is confirmed 🎉"
              />
            )}
            <TextField
              label="Body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              multiline
              rows={8}
              placeholder={form.channel === 'email'
                ? 'Hi {{customer_name}},\n\nYour session on {{session_date}} is confirmed!\n\nSee you there,\nThe Throw Team'
                : 'Hi {{customer_name}}! Your {{session_name}} on {{session_date}} is confirmed. See you soon! - Throw'
              }
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.875rem' } } }}
            />
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent><DialogContentText>This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
