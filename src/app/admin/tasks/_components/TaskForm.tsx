'use client';

import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const TZ = 'America/Denver';
const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

interface StaffUser { id: string; name: string | null; email: string; }
interface CustomerResult { id: string; name: string | null; email: string; }

export interface TaskFormValues {
  title: string;
  description: string;
  assignedToId: string;
  linkedCustomerId: string;
  linkedCustomerLabel: string;
  dueAt: string;
  status: string;
}

interface Props {
  initialValues?: Partial<TaskFormValues>;
  isEdit?: boolean;
  staffList: StaffUser[];
  saving: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm"); }
  catch { return ''; }
}

export function TaskForm({ initialValues, isEdit = false, staffList, saving, error, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [assignedToId, setAssignedToId] = useState(initialValues?.assignedToId ?? '');
  const [linkedCustomerId, setLinkedCustomerId] = useState(initialValues?.linkedCustomerId ?? '');
  const [customerQuery, setCustomerQuery] = useState(initialValues?.linkedCustomerLabel ?? '');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dueAt, setDueAt] = useState(toInputValue(initialValues?.dueAt));
  const [status, setStatus] = useState(initialValues?.status ?? 'OPEN');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleCustomerInput(value: string) {
    setCustomerQuery(value);
    setLinkedCustomerId('');
    clearTimeout(timer.current);
    if (!value.trim()) { setCustomerResults([]); setShowDropdown(false); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(value)}`);
      if (res.ok) { setCustomerResults(await res.json() as CustomerResult[]); setShowDropdown(true); }
    }, 250);
  }

  function selectCustomer(c: CustomerResult) {
    setLinkedCustomerId(c.id);
    setCustomerQuery(c.name ?? c.email);
    setShowDropdown(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let dueAtIso = '';
    if (dueAt) { try { dueAtIso = fromZonedTime(dueAt, TZ).toISOString(); } catch { dueAtIso = ''; } }
    onSubmit({ title, description, assignedToId, linkedCustomerId, linkedCustomerLabel: customerQuery, dueAt: dueAtIso, status });
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
        />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="assignee-label">Assigned to</InputLabel>
              <Select
                labelId="assignee-label"
                value={assignedToId}
                label="Assigned to"
                onChange={(e) => setAssignedToId(e.target.value)}
              >
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {staffList.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name ?? s.email}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Due date (Mountain Time)"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Grid>
        </Grid>

        {/* Customer typeahead */}
        <Box ref={dropdownRef} sx={{ position: 'relative' }}>
          <TextField
            label="Linked customer"
            value={customerQuery}
            onChange={(e) => handleCustomerInput(e.target.value)}
            placeholder="Search by name or email…"
            autoComplete="off"
            fullWidth
            helperText={linkedCustomerId ? 'Customer linked — type to change' : undefined}
          />
          {showDropdown && customerResults.length > 0 && (
            <Paper
              elevation={4}
              sx={{
                position: 'absolute',
                zIndex: 1400,
                mt: 0.5,
                width: '100%',
                maxHeight: 200,
                overflowY: 'auto',
                borderRadius: 2,
              }}
            >
              {customerResults.map((c) => (
                <Box
                  key={c.id}
                  onMouseDown={() => selectCustomer(c)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.email}</Typography>
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        {isEdit && (
          <FormControl fullWidth>
            <InputLabel id="status-label">Status</InputLabel>
            <Select
              labelId="status-label"
              value={status}
              label="Status"
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 1 }}>
          <Button variant="outlined" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
