'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { layoutOverlappingEvents } from '@/lib/calendarLayout';
import { getSessionTypeColor } from '@/lib/scheduleColors';

interface StudioSession {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isCancelled: boolean;
  sessionType: { id: string; name: string; durationMinutes: number; capacity: number };
  instructor: { id: string; name: string | null } | null;
  _count: { bookings: number };
}

// ─── Time-grid layout constants ─────────────────────────────────────────────
const HOUR_HEIGHT = 48; // px per hour
const MIN_EVENT_HEIGHT = 22; // px — keeps even 15-min slots tappable/legible
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const GRID_GUTTER_WIDTH = 44; // px, hour-label column

function getGridBounds(sessions: StudioSession[]): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const s of sessions) {
    const start = toZonedTime(new Date(s.startsAt), STUDIO_TIMEZONE);
    const end = toZonedTime(new Date(s.endsAt), STUDIO_TIMEZONE);
    const startHourOfDay = start.getHours() + start.getMinutes() / 60;
    const endHourOfDay = Math.min(24, end.getHours() + end.getMinutes() / 60 || 24);
    startHour = Math.min(startHour, Math.floor(startHourOfDay));
    endHour = Math.max(endHour, Math.ceil(endHourOfDay));
  }
  return { startHour, endHour };
}

function minutesFromGridStart(date: Date, startHour: number): number {
  const zoned = toZonedTime(date, STUDIO_TIMEZONE);
  return (zoned.getHours() - startHour) * 60 + zoned.getMinutes();
}

function formatHourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 || hour === 24 ? 'AM' : 'PM';
  return `${h} ${suffix}`;
}

interface SessionTypeOption {
  id: string;
  name: string;
  durationMinutes: number;
  capacity: number;
  isActive: boolean;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

const NONE = '__none__';

function getWeekDays(offset: number): Date[] {
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const weekStart = startOfWeek(addWeeks(nowMT, offset), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function sessionDayKey(session: StudioSession): string {
  return formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, 'yyyy-MM-dd');
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionTypeOption[]>([]);
  const [instructors, setInstructors] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    sessionTypeId: '',
    localDate: '',
    localTime: '09:00',
    instructorId: NONE,
    capacityOverride: '',
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editSession, setEditSession] = useState<StudioSession | null>(null);
  const [editForm, setEditForm] = useState({ instructorId: NONE, capacity: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const weekDays = getWeekDays(weekOffset);
  const { startHour, endHour } = useMemo(() => getGridBounds(sessions), [sessions]);
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const todayKey = dayKey(toZonedTime(new Date(nowTick), STUDIO_TIMEZONE));
  const nowOffset = useMemo(() => {
    const nowMT = toZonedTime(new Date(nowTick), STUDIO_TIMEZONE);
    const hourOfDay = nowMT.getHours() + nowMT.getMinutes() / 60;
    if (hourOfDay < startHour || hourOfDay > endHour) return null;
    return (hourOfDay - startHour) * HOUR_HEIGHT;
  }, [nowTick, startHour, endHour]);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    const fromUTC = fromZonedTime(`${dayKey(weekDays[0])}T00:00:00`, STUDIO_TIMEZONE);
    const toUTC = fromZonedTime(`${dayKey(addDays(weekDays[0], 7))}T00:00:00`, STUDIO_TIMEZONE);
    fetch(`/api/admin/studio-sessions?from=${fromUTC.toISOString()}&to=${toUTC.toISOString()}`)
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    fetch('/api/admin/session-types')
      .then((r) => r.json())
      .then((data: SessionTypeOption[]) => setSessionTypes(data.filter((st) => st.isActive)));
    fetch('/api/admin/users').then((r) => r.json()).then(setInstructors);
  }, []);

  const weekLabel = `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`;

  function openAdd(defaultDate?: string, defaultTime?: string) {
    setAddForm({
      sessionTypeId: sessionTypes[0]?.id ?? '',
      localDate: defaultDate ?? dayKey(weekDays[0]),
      localTime: defaultTime ?? '09:00',
      instructorId: NONE,
      capacityOverride: '',
    });
    setAddError(null);
    setAddOpen(true);
  }

  function openEdit(session: StudioSession) {
    setEditSession(session);
    setEditForm({ instructorId: session.instructor?.id ?? NONE, capacity: String(session.capacity) });
    setEditError(null);
  }

  async function handleAddSave() {
    setAddSaving(true);
    setAddError(null);
    const res = await fetch('/api/admin/studio-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionTypeId: addForm.sessionTypeId,
        localDate: addForm.localDate,
        localTime: addForm.localTime,
        instructorId: addForm.instructorId === NONE ? null : addForm.instructorId,
        capacityOverride: addForm.capacityOverride ? Number(addForm.capacityOverride) : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setAddError(data.error ?? 'Failed to create session');
      setAddSaving(false);
      return;
    }
    const created = (await res.json()) as StudioSession;
    setSessions((prev) => [...prev, created]);
    setAddOpen(false);
    setAddSaving(false);
  }

  async function handleEditSave() {
    if (!editSession) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: editForm.instructorId === NONE ? null : editForm.instructorId,
        capacity: Number(editForm.capacity),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setEditError(data.error ?? 'Save failed');
      setEditSaving(false);
      return;
    }
    const updated = (await res.json()) as StudioSession;
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditSession(null);
    setEditSaving(false);
  }

  async function handleCancelSession() {
    if (!editSession) return;
    setCancelConfirmOpen(false);
    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCancelled: true }),
    });
    if (res.ok) {
      const updated = (await res.json()) as StudioSession;
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditSession(null);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Schedule</Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: 180, textAlign: 'center', fontWeight: 500 }}>
              {weekLabel}
            </Typography>
            <IconButton size="small" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRightIcon />
            </IconButton>
            {weekOffset !== 0 && (
              <Button size="small" variant="text" onClick={() => setWeekOffset(0)}>
                Today
              </Button>
            )}
          </Stack>
        </Box>
        <Button variant="contained" onClick={() => openAdd()} startIcon={<AddIcon />}>
          Add session
        </Button>
      </Box>

      {/* Week time-grid */}
      <Box sx={{ flex: 1, overflowX: 'auto' }}>
        <Box sx={{ minWidth: 760 }}>
          {/* Day header row */}
          <Box sx={{ display: 'flex' }}>
            <Box sx={{ width: GRID_GUTTER_WIDTH, flexShrink: 0 }} />
            {weekDays.map((day) => {
              const key = dayKey(day);
              const isToday = key === todayKey;
              return (
                <Box
                  key={key}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 0.5,
                    pb: 0.75,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: isToday ? 'primary.main' : 'text.secondary' }}
                  >
                    {format(day, 'EEE M/d')}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => openAdd(key)}
                    title="Add session"
                    sx={{ p: 0.25, color: 'text.secondary' }}
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>

          {/* Time-grid body */}
          <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {/* Hour gutter */}
            <Box sx={{ width: GRID_GUTTER_WIDTH, flexShrink: 0, position: 'relative', height: gridHeight, bgcolor: 'background.paper' }}>
              {hourMarks.map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    position: 'absolute',
                    top: (hour - startHour) * HOUR_HEIGHT - 7,
                    right: 6,
                    fontSize: '0.625rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatHourLabel(hour)}
                </Typography>
              ))}
            </Box>

            {/* Day columns */}
            {weekDays.map((day) => {
              const key = dayKey(day);
              const isToday = key === todayKey;
              const daySessions = sessions.filter((s) => sessionDayKey(s) === key);
              const laidOut = layoutOverlappingEvents(daySessions);

              return (
                <Box
                  key={key}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rawMinutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
                    const snapped = Math.max(0, Math.round(rawMinutes / 15) * 15);
                    const totalMinutes = startHour * 60 + snapped;
                    const h = Math.floor(totalMinutes / 60) % 24;
                    const m = totalMinutes % 60;
                    openAdd(key, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    position: 'relative',
                    height: gridHeight,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isToday ? 'action.hover' : 'background.paper',
                    cursor: 'copy',
                  }}
                >
                  {/* Hour gridlines */}
                  {hourMarks.map((hour) => (
                    <Box
                      key={hour}
                      sx={{
                        position: 'absolute',
                        top: (hour - startHour) * HOUR_HEIGHT,
                        left: 0,
                        right: 0,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  ))}

                  {/* Current-time indicator */}
                  {isToday && nowOffset !== null && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: nowOffset,
                        left: 0,
                        right: 0,
                        borderTop: '2px solid',
                        borderColor: 'error.main',
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: -4,
                          top: -4,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'error.main',
                        }}
                      />
                    </Box>
                  )}

                  {loading ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 4,
                        right: 4,
                        height: 48,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                  ) : (
                    laidOut.map(({ event: session, lane, lanesInCluster }) => {
                      const color = getSessionTypeColor(session.sessionType.id);
                      const top = (minutesFromGridStart(new Date(session.startsAt), startHour) / 60) * HOUR_HEIGHT;
                      const rawHeight =
                        (minutesFromGridStart(new Date(session.endsAt), startHour) / 60) * HOUR_HEIGHT - top;
                      const height = Math.max(MIN_EVENT_HEIGHT, rawHeight);
                      const widthPct = 100 / lanesInCluster;
                      const leftPct = lane * widthPct;
                      const isTiny = height < 40;

                      return (
                        <Tooltip
                          key={session.id}
                          title={
                            `${session.sessionType.name} · ` +
                            formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, 'h:mm a') +
                            (session.instructor?.name ? ` · ${session.instructor.name}` : '') +
                            ` · ${session._count.bookings}/${session.capacity}` +
                            (session.isCancelled ? ' · Cancelled' : '')
                          }
                        >
                          <Box
                            component="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(session);
                            }}
                            sx={{
                              position: 'absolute',
                              top,
                              height,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              textAlign: 'left',
                              cursor: 'pointer',
                              border: 'none',
                              borderLeft: '3px solid',
                              borderLeftColor: color.border,
                              borderRadius: '4px',
                              bgcolor: color.bg,
                              color: color.text,
                              px: isTiny ? 0.5 : 0.75,
                              py: isTiny ? 0 : 0.25,
                              overflow: 'hidden',
                              opacity: session.isCancelled ? 0.55 : 1,
                              zIndex: 2,
                              '&:hover': { filter: 'brightness(0.96)' },
                              transition: 'filter 0.1s',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                fontWeight: 600,
                                lineHeight: 1.2,
                                fontSize: '0.6875rem',
                                whiteSpace: isTiny ? 'nowrap' : 'normal',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textDecoration: session.isCancelled ? 'line-through' : 'none',
                              }}
                            >
                              {session.sessionType.name}
                            </Typography>
                            {!isTiny && (
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.625rem', opacity: 0.85 }}
                              >
                                {formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, 'h:mm a')}
                                {session.instructor?.name ? ` · ${session.instructor.name}` : ''}
                              </Typography>
                            )}
                          </Box>
                        </Tooltip>
                      );
                    })
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Add session dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add session</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <FormControl size="small" fullWidth>
              <InputLabel>Class type</InputLabel>
              <Select
                value={addForm.sessionTypeId}
                label="Class type"
                onChange={(e) => setAddForm((f) => ({ ...f, sessionTypeId: e.target.value }))}
              >
                {sessionTypes.map((st) => (
                  <MenuItem key={st.id} value={st.id}>{st.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Date (MT)"
                  type="date"
                  value={addForm.localDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, localDate: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Start time (MT)"
                  type="time"
                  value={addForm.localTime}
                  onChange={(e) => setAddForm((f) => ({ ...f, localTime: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
            <FormControl size="small" fullWidth>
              <InputLabel>Instructor</InputLabel>
              <Select
                value={addForm.instructorId}
                label="Instructor"
                onChange={(e) => setAddForm((f) => ({ ...f, instructorId: e.target.value }))}
              >
                <MenuItem value={NONE}>None</MenuItem>
                {instructors.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.name ?? u.email}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Capacity override"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              placeholder="Leave blank to use class type default"
              value={addForm.capacityOverride}
              onChange={(e) => setAddForm((f) => ({ ...f, capacityOverride: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSave} disabled={addSaving}>
            {addSaving ? 'Saving…' : 'Add session'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit session dialog */}
      <Dialog
        open={editSession !== null}
        onClose={() => setEditSession(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editSession?.sessionType.name}
            {editSession?.isCancelled && (
              <Chip label="Cancelled" size="small" color="error" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {editSession && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {formatInTimeZone(new Date(editSession.startsAt), STUDIO_TIMEZONE, "EEE, MMM d 'at' h:mm a")} MT
              </Typography>
              {editError && <Alert severity="error">{editError}</Alert>}
              {!editSession.isCancelled && (
                <>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Instructor</InputLabel>
                    <Select
                      value={editForm.instructorId}
                      label="Instructor"
                      onChange={(e) => setEditForm((f) => ({ ...f, instructorId: e.target.value }))}
                    >
                      <MenuItem value={NONE}>None</MenuItem>
                      {instructors.map((u) => (
                        <MenuItem key={u.id} value={u.id}>{u.name ?? u.email}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Capacity"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={editForm.capacity}
                    onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
                  />
                </>
              )}
              <Typography variant="body2" color="text.secondary">
                {editSession._count.bookings} booking{editSession._count.bookings === 1 ? '' : 's'} / {editSession.capacity} capacity
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          {editSession && !editSession.isCancelled && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => setCancelConfirmOpen(true)}
              sx={{ mr: 'auto' }}
            >
              Cancel session
            </Button>
          )}
          <Button variant="outlined" onClick={() => setEditSession(null)}>Close</Button>
          {editSession && !editSession.isCancelled && (
            <Button variant="contained" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Cancel session confirmation */}
      <Dialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel this session?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will cancel all confirmed bookings for this session. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCancelConfirmOpen(false)}>
            Keep session
          </Button>
          <Button variant="contained" color="error" onClick={handleCancelSession}>
            Yes, cancel session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
