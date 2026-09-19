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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
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
import { resolveClassPriceCents } from '@/lib/sellable';
import { ALL_LOCATIONS, useLocationFilter } from '../_components/LocationFilterContext';

interface StudioSession {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isCancelled: boolean;
  seriesId: string | null;
  // Per-session overrides: a workshop's topic or a private group's name, its
  // own price, and whether a class ticket books it. null = the class type's.
  title: string | null;
  priceCentsOverride: number | null;
  isTicketEligibleOverride: boolean | null;
  /** Resolved by the API for this session's studio (src/lib/sellable.ts). */
  priceCents: number;
  isTicketEligible: boolean;
  sessionType: {
    id: string;
    name: string;
    durationMinutes: number;
    capacity: number;
    isTicketEligible: boolean;
    archivedAt: string | null;
  };
  instructor: { id: string; name: string | null } | null;
  location: { id: string; name: string } | null;
  _count: { bookings: number };
}

// ─── Time-grid layout constants ─────────────────────────────────────────────
const HOUR_HEIGHT = 48; // px per hour
const MIN_EVENT_HEIGHT = 22; // px — keeps even 15-min slots tappable/legible
const DEFAULT_START_HOUR = 5;
const DEFAULT_END_HOUR = 23;
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
  isTemplate: boolean;
  archivedAt: string | null;
  isTicketEligible: boolean;
  dropInPriceCents: number;
  memberPriceCents: number | null;
  locationPrices: { locationId: string; priceCents: number; memberPriceCents: number | null }[];
  /** null = runs at every studio, so the session has to pick one. */
  location: { id: string; name: string } | null;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

const NONE = '__none__';

// Ticket-eligibility override choices; 'default' stores null.
type TicketChoice = 'default' | 'yes' | 'no';

function ticketChoice(override: boolean | null): TicketChoice {
  return override === null ? 'default' : override ? 'yes' : 'no';
}

function ticketOverride(choice: TicketChoice): boolean | null {
  return choice === 'default' ? null : choice === 'yes';
}

function sessionName(session: StudioSession): string {
  return session.title ?? session.sessionType.name;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Cents from a dollar field; null when blank, NaN when it isn't a price. */
function toCents(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

// Mirrors MAX_REPEAT_WEEKLY in /api/admin/studio-sessions, which enforces it.
const MAX_REPEAT_WEEKLY = 12;
const DEFAULT_REPEAT_COUNT = '4';

interface SkippedSlot {
  startsAt: string;
  reason: string;
}

interface SessionWithBookings {
  id: string;
  startsAt: string;
  bookingCount: number;
}

function formatSlot(iso: string): string {
  return formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, "EEE, MMM d 'at' h:mm a");
}

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
  const { locations, selectedLocationId } = useLocationFilter();
  const [weekOffset, setWeekOffset] = useState(0);
  // Upcoming sessions of archived class types are hidden unless asked for.
  const [showArchived, setShowArchived] = useState(false);
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionTypeOption[]>([]);
  const [instructors, setInstructors] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [showAllClassTypes, setShowAllClassTypes] = useState(false);
  const [addForm, setAddForm] = useState({
    sessionTypeId: '',
    locationId: '',
    localDate: '',
    localTime: '09:00',
    instructorId: NONE,
    capacityOverride: '',
    title: '',
    priceOverride: '',
    ticketChoice: 'default' as TicketChoice,
    repeatWeekly: false,
    repeatCount: DEFAULT_REPEAT_COUNT,
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Outcome of a repeat-weekly create, shown in the dialog before it closes.
  const [addResult, setAddResult] = useState<{ created: number; skipped: SkippedSlot[] } | null>(null);

  const pickableSessionTypes = showAllClassTypes
    ? sessionTypes
    : sessionTypes.filter((st) => st.isTemplate);

  const [editSession, setEditSession] = useState<StudioSession | null>(null);
  const [editForm, setEditForm] = useState({
    instructorId: NONE,
    capacity: '',
    title: '',
    priceOverride: '',
    ticketChoice: 'default' as TicketChoice,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [seriesDeleteOpen, setSeriesDeleteOpen] = useState(false);
  const [seriesDeleting, setSeriesDeleting] = useState(false);
  const [seriesDeleteError, setSeriesDeleteError] = useState<{
    message: string;
    sessions: SessionWithBookings[];
  } | null>(null);

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
    const locationParam = selectedLocationId === ALL_LOCATIONS ? '' : `&locationId=${selectedLocationId}`;
    const archivedParam = showArchived ? '&includeArchived=1' : '';
    fetch(`/api/admin/studio-sessions?from=${fromUTC.toISOString()}&to=${toUTC.toISOString()}${locationParam}${archivedParam}`)
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, selectedLocationId, showArchived]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    const url =
      selectedLocationId === ALL_LOCATIONS
        ? '/api/admin/session-types'
        : `/api/admin/session-types?locationId=${selectedLocationId}`;
    fetch(url)
      .then((r) => r.json())
      // Archived class types can't be scheduled.
      .then((data: SessionTypeOption[]) =>
        setSessionTypes(data.filter((st) => st.isActive && st.archivedAt === null)),
      );
    fetch('/api/admin/users').then((r) => r.json()).then(setInstructors);
  }, [selectedLocationId]);

  const weekLabel = `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`;

  function openAdd(defaultDate?: string, defaultTime?: string) {
    setShowAllClassTypes(false);
    setAddForm({
      sessionTypeId: pickableSessionTypes[0]?.id ?? sessionTypes[0]?.id ?? '',
      locationId: selectedLocationId === ALL_LOCATIONS ? (locations[0]?.id ?? '') : selectedLocationId,
      localDate: defaultDate ?? dayKey(weekDays[0]),
      localTime: defaultTime ?? '09:00',
      instructorId: NONE,
      capacityOverride: '',
      title: '',
      priceOverride: '',
      ticketChoice: 'default',
      repeatWeekly: false,
      repeatCount: DEFAULT_REPEAT_COUNT,
    });
    setAddError(null);
    setAddResult(null);
    setAddOpen(true);
  }

  function openEdit(session: StudioSession) {
    setEditSession(session);
    setEditForm({
      instructorId: session.instructor?.id ?? NONE,
      capacity: String(session.capacity),
      title: session.title ?? '',
      priceOverride: session.priceCentsOverride === null ? '' : (session.priceCentsOverride / 100).toFixed(2),
      ticketChoice: ticketChoice(session.isTicketEligibleOverride),
    });
    setEditError(null);
    setSeriesDeleteError(null);
  }

  const repeatCountNumber = Number(addForm.repeatCount);
  const repeatCountValid =
    Number.isInteger(repeatCountNumber) && repeatCountNumber >= 1 && repeatCountNumber <= MAX_REPEAT_WEEKLY;

  // The class type being added, the studio the session lands in, and what the
  // class type charges there — shown so staff know what an override replaces.
  const addType = sessionTypes.find((st) => st.id === addForm.sessionTypeId) ?? null;
  const addLocationId = addType?.location?.id ?? addForm.locationId;
  const addTypePriceCents = addType
    ? resolveClassPriceCents({ sessionType: addType, locationId: addLocationId || null })
    : 0;

  async function handleAddSave() {
    const priceCentsOverride = toCents(addForm.priceOverride);
    if (Number.isNaN(priceCentsOverride)) {
      setAddError('Price must be a dollar amount, or blank');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const res = await fetch('/api/admin/studio-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionTypeId: addForm.sessionTypeId,
        locationId: addLocationId || undefined,
        title: addForm.title.trim() || null,
        priceCentsOverride,
        isTicketEligibleOverride: ticketOverride(addForm.ticketChoice),
        localDate: addForm.localDate,
        localTime: addForm.localTime,
        instructorId: addForm.instructorId === NONE ? null : addForm.instructorId,
        capacityOverride: addForm.capacityOverride ? Number(addForm.capacityOverride) : undefined,
        ...(addForm.repeatWeekly && { repeatWeekly: { count: repeatCountNumber } }),
      }),
    });

    if (addForm.repeatWeekly) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: StudioSession[];
        skipped?: SkippedSlot[];
      };
      if (!res.ok && !data.skipped) {
        setAddError(data.error ?? 'Failed to create sessions');
        setAddSaving(false);
        return;
      }
      // The series spans several weeks, so reload the visible week rather than
      // splicing in sessions that may belong to other weeks.
      fetchSessions();
      setAddResult({ created: data.created?.length ?? 0, skipped: data.skipped ?? [] });
      setAddSaving(false);
      return;
    }

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

  async function handleDeleteSeries() {
    if (!editSession) return;
    setSeriesDeleting(true);
    setSeriesDeleteError(null);
    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}?scope=series`, {
      method: 'DELETE',
    });
    setSeriesDeleting(false);
    setSeriesDeleteOpen(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionsWithBookings?: SessionWithBookings[];
      };
      setSeriesDeleteError({
        message: data.error ?? 'Failed to delete the series',
        sessions: data.sessionsWithBookings ?? [],
      });
      return;
    }
    setEditSession(null);
    fetchSessions();
  }

  async function handleEditSave() {
    if (!editSession) return;
    const priceCentsOverride = toCents(editForm.priceOverride);
    if (Number.isNaN(priceCentsOverride)) {
      setEditError('Price must be a dollar amount, or blank');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/studio-sessions/${editSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructorId: editForm.instructorId === NONE ? null : editForm.instructorId,
        capacity: Number(editForm.capacity),
        title: editForm.title.trim() || null,
        priceCentsOverride,
        isTicketEligibleOverride: ticketOverride(editForm.ticketChoice),
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
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
            }
            label={<Typography variant="body2">Show archived class types</Typography>}
          />
          <Button variant="contained" onClick={() => openAdd()} startIcon={<AddIcon />}>
            Add session
          </Button>
        </Stack>
      </Box>

      {/* Week time-grid */}
      <Box sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
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

          {/* Time-grid body — its own scroll region so the day headers above stay put */}
          <Box
            sx={{
              display: 'flex',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
            }}
          >
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
                            `${sessionName(session)} · ` +
                            (session.title ? `${session.sessionType.name} · ` : '') +
                            formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, 'h:mm a') +
                            (session.instructor?.name ? ` · ${session.instructor.name}` : '') +
                            ` · ${session._count.bookings}/${session.capacity}` +
                            (session.priceCents > 0 ? ` · ${money(session.priceCents)}` : '') +
                            (selectedLocationId === ALL_LOCATIONS && session.location?.name ? ` · ${session.location.name}` : '') +
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
                              {sessionName(session)}
                            </Typography>
                            {!isTiny && (
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.625rem', opacity: 0.85 }}
                              >
                                {formatInTimeZone(new Date(session.startsAt), STUDIO_TIMEZONE, 'h:mm a')}
                                {session.instructor?.name ? ` · ${session.instructor.name}` : ''}
                                {selectedLocationId === ALL_LOCATIONS && session.location?.name ? ` · ${session.location.name}` : ''}
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
          {addResult ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {addResult.created > 0 ? (
                <Alert severity="success">
                  Created {addResult.created} weekly session{addResult.created === 1 ? '' : 's'}.
                </Alert>
              ) : (
                <Alert severity="error">No sessions were created.</Alert>
              )}
              {addResult.skipped.length > 0 && (
                <Alert severity="warning">
                  Skipped {addResult.skipped.length} week{addResult.skipped.length === 1 ? '' : 's'} that
                  already had this class at this time:
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {addResult.skipped.map((s) => (
                      <li key={s.startsAt}>{formatSlot(s.startsAt)} MT</li>
                    ))}
                  </Box>
                </Alert>
              )}
            </Stack>
          ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <FormControl size="small" fullWidth>
              <InputLabel>Class type</InputLabel>
              <Select
                value={addForm.sessionTypeId}
                label="Class type"
                onChange={(e) => setAddForm((f) => ({ ...f, sessionTypeId: e.target.value }))}
              >
                {pickableSessionTypes.map((st) => (
                  <MenuItem key={st.id} value={st.id}>{st.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={showAllClassTypes}
                  onChange={(e) => setShowAllClassTypes(e.target.checked)}
                />
              }
              label="Show all class types (including one-offs)"
              sx={{ mt: -1.5 }}
            />
            {addType && !addType.location && (
              <FormControl size="small" fullWidth>
                <InputLabel>Studio</InputLabel>
                <Select
                  value={addForm.locationId}
                  label="Studio"
                  onChange={(e) => setAddForm((f) => ({ ...f, locationId: e.target.value }))}
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Title (optional)"
              size="small"
              placeholder={addType?.name}
              helperText="Shown instead of the class type name: a workshop's topic, a private group's name."
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 120 } }}
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            />
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
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Price override ($)"
                  type="number"
                  size="small"
                  fullWidth
                  placeholder={addType ? money(addTypePriceCents) : undefined}
                  helperText={addType ? `Blank = class type price, ${money(addTypePriceCents)}` : undefined}
                  slotProps={{ htmlInput: { min: 0, step: 0.01 }, inputLabel: { shrink: true } }}
                  value={addForm.priceOverride}
                  onChange={(e) => setAddForm((f) => ({ ...f, priceOverride: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Class tickets</InputLabel>
                  <Select
                    value={addForm.ticketChoice}
                    label="Class tickets"
                    onChange={(e) => setAddForm((f) => ({ ...f, ticketChoice: e.target.value as TicketChoice }))}
                  >
                    <MenuItem value="default">
                      Class type default ({addType?.isTicketEligible ? 'accepted' : 'not accepted'})
                    </MenuItem>
                    <MenuItem value="yes">Accepted</MenuItem>
                    <MenuItem value="no">Not accepted</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={addForm.repeatWeekly}
                    onChange={(e) => setAddForm((f) => ({ ...f, repeatWeekly: e.target.checked }))}
                  />
                }
                label="Repeat weekly"
              />
              {addForm.repeatWeekly && (
                <TextField
                  label="Number of weeks"
                  type="number"
                  size="small"
                  fullWidth
                  sx={{ mt: 1.5 }}
                  slotProps={{ htmlInput: { min: 1, max: MAX_REPEAT_WEEKLY } }}
                  value={addForm.repeatCount}
                  onChange={(e) => setAddForm((f) => ({ ...f, repeatCount: e.target.value }))}
                  error={!repeatCountValid}
                  helperText={
                    repeatCountValid
                      ? 'One session per week on the same weekday and time, starting on the date above.'
                      : `Enter a number from 1 to ${MAX_REPEAT_WEEKLY}.`
                  }
                />
              )}
            </Box>
          </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {addResult ? (
            <Button variant="contained" onClick={() => setAddOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outlined" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleAddSave}
                disabled={addSaving || (addForm.repeatWeekly && !repeatCountValid)}
              >
                {addSaving
                  ? 'Saving…'
                  : addForm.repeatWeekly && repeatCountValid
                    ? `Add ${repeatCountNumber} session${repeatCountNumber === 1 ? '' : 's'}`
                    : 'Add session'}
              </Button>
            </>
          )}
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
            {editSession && sessionName(editSession)}
            {editSession?.isCancelled && (
              <Chip label="Cancelled" size="small" color="error" />
            )}
            {editSession?.sessionType.archivedAt && (
              <Chip label="Archived class type" size="small" variant="outlined" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {editSession && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {editSession.title ? `${editSession.sessionType.name} · ` : ''}
                {formatInTimeZone(new Date(editSession.startsAt), STUDIO_TIMEZONE, "EEE, MMM d 'at' h:mm a")} MT
                {editSession.location?.name ? ` · ${editSession.location.name}` : ''}
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
                  <TextField
                    label="Title (optional)"
                    size="small"
                    placeholder={editSession.sessionType.name}
                    helperText="Shown instead of the class type name."
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 120 } }}
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        label="Price override ($)"
                        type="number"
                        size="small"
                        fullWidth
                        placeholder="Class type price"
                        helperText={`Charges ${money(editSession.priceCents)} now`}
                        slotProps={{ htmlInput: { min: 0, step: 0.01 }, inputLabel: { shrink: true } }}
                        value={editForm.priceOverride}
                        onChange={(e) => setEditForm((f) => ({ ...f, priceOverride: e.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Class tickets</InputLabel>
                        <Select
                          value={editForm.ticketChoice}
                          label="Class tickets"
                          onChange={(e) => setEditForm((f) => ({ ...f, ticketChoice: e.target.value as TicketChoice }))}
                        >
                          <MenuItem value="default">
                            Class type default ({editSession.sessionType.isTicketEligible ? 'accepted' : 'not accepted'})
                          </MenuItem>
                          <MenuItem value="yes">Accepted</MenuItem>
                          <MenuItem value="no">Not accepted</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </>
              )}
              <Typography variant="body2" color="text.secondary">
                {editSession._count.bookings} booking{editSession._count.bookings === 1 ? '' : 's'} / {editSession.capacity} capacity
              </Typography>
              {editSession.seriesId && (
                <Typography variant="caption" color="text.secondary">
                  Part of a weekly series.
                </Typography>
              )}
              {seriesDeleteError && (
                <Alert severity="error">
                  {seriesDeleteError.message}
                  {seriesDeleteError.sessions.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {seriesDeleteError.sessions.map((s) => (
                        <li key={s.id}>
                          {formatSlot(s.startsAt)} MT · {s.bookingCount} booking{s.bookingCount === 1 ? '' : 's'}
                        </li>
                      ))}
                    </Box>
                  )}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          {editSession && !editSession.isCancelled && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => setCancelConfirmOpen(true)}
              sx={{ mr: editSession.seriesId ? 0 : 'auto' }}
            >
              Cancel session
            </Button>
          )}
          {editSession?.seriesId && (
            <Button
              color="error"
              variant="text"
              onClick={() => setSeriesDeleteOpen(true)}
              sx={{ mr: 'auto' }}
            >
              Delete this and following
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

      {/* Delete series confirmation */}
      <Dialog
        open={seriesDeleteOpen}
        onClose={() => setSeriesDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete this and following sessions?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This deletes this session and every later session in its weekly series. If any of
            them has bookings, nothing is deleted and you&apos;ll see which ones.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setSeriesDeleteOpen(false)}>
            Keep sessions
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSeries}
            disabled={seriesDeleting}
          >
            {seriesDeleting ? 'Deleting…' : 'Delete sessions'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
