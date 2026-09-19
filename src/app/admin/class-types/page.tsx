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
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { resolveClassPriceCents } from '@/lib/sellable';
import { ALL_LOCATIONS, useLocationFilter, type LocationOption } from '../_components/LocationFilterContext';

interface LocationPrice {
  locationId: string;
  priceCents: number;
  memberPriceCents: number | null;
  isConfirmed: boolean;
}

interface SessionType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  capacity: number;
  dropInPriceCents: number;
  memberPriceCents: number | null;
  isBusyWindow: boolean;
  isActive: boolean;
  isTemplate: boolean;
  kind: string;
  tags: string[];
  priceUnit: string;
  maxPeoplePerWheel: number;
  allowsWheelSharing: boolean;
  isTicketEligible: boolean;
  membersOnly: boolean;
  isPublic: boolean;
  minAge: number | null;
  maxAge: number | null;
  archivedAt: string | null;
  location: { id: string; name: string } | null;
  locationPrices: LocationPrice[];
  _count: { studioSessions: number };
}

const KIND_LABELS: Record<string, string> = { EVENT: 'Event', COURSE: 'Course' };
const UNIT_LABELS: Record<string, string> = {
  PER_WHEEL: 'Per wheel',
  PER_PERSON: 'Per person',
  FLAT: 'Flat',
};

// "" in the studio picker: the class runs at every studio and is priced per studio.
const EVERY_STUDIO = '';

interface StudioPriceForm {
  priceDollars: string; // blank = use the default price at this studio
  memberPriceDollars: string;
  isConfirmed: boolean;
}

interface FormState {
  name: string;
  description: string;
  kind: string;
  durationMinutes: string;
  capacity: string;
  dropInPriceDollars: string;
  memberPriceDollars: string;
  priceUnit: string;
  studioPrices: Record<string, StudioPriceForm>;
  maxPeoplePerWheel: string;
  allowsWheelSharing: boolean;
  isTicketEligible: boolean;
  membersOnly: boolean;
  isPublic: boolean;
  minAge: string;
  maxAge: string;
  tags: string;
  isBusyWindow: boolean;
  isTemplate: boolean;
  locationId: string;
}

function dollars(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
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

function defaultForm(): FormState {
  return {
    name: '',
    description: '',
    kind: 'EVENT',
    durationMinutes: '120',
    capacity: '12',
    dropInPriceDollars: '0.00',
    memberPriceDollars: '',
    priceUnit: 'PER_PERSON',
    studioPrices: {},
    maxPeoplePerWheel: '1',
    allowsWheelSharing: false,
    isTicketEligible: true,
    membersOnly: false,
    isPublic: true,
    minAge: '',
    maxAge: '',
    tags: '',
    isBusyWindow: false,
    isTemplate: true,
    locationId: EVERY_STUDIO,
  };
}

function toForm(st: SessionType): FormState {
  return {
    name: st.name,
    description: st.description ?? '',
    kind: st.kind,
    durationMinutes: String(st.durationMinutes),
    capacity: String(st.capacity),
    dropInPriceDollars: dollars(st.dropInPriceCents),
    memberPriceDollars: dollars(st.memberPriceCents),
    priceUnit: st.priceUnit,
    studioPrices: Object.fromEntries(
      st.locationPrices.map((p) => [
        p.locationId,
        {
          priceDollars: dollars(p.priceCents),
          memberPriceDollars: dollars(p.memberPriceCents),
          isConfirmed: p.isConfirmed,
        },
      ]),
    ),
    maxPeoplePerWheel: String(st.maxPeoplePerWheel),
    allowsWheelSharing: st.allowsWheelSharing,
    isTicketEligible: st.isTicketEligible,
    membersOnly: st.membersOnly,
    isPublic: st.isPublic,
    minAge: st.minAge === null ? '' : String(st.minAge),
    maxAge: st.maxAge === null ? '' : String(st.maxAge),
    tags: st.tags.join(', '),
    isBusyWindow: st.isBusyWindow,
    isTemplate: st.isTemplate,
    locationId: st.location?.id ?? EVERY_STUDIO,
  };
}

const BLANK_STUDIO_PRICE: StudioPriceForm = { priceDollars: '', memberPriceDollars: '', isConfirmed: true };

function isArchived(st: SessionType): boolean {
  return st.archivedAt !== null || !st.isActive;
}

/** What the class costs at each studio it can run at, via the shared resolver. */
function PriceCell({ st, locations }: { st: SessionType; locations: LocationOption[] }) {
  const studios = st.location ? locations.filter((l) => l.id === st.location?.id) : locations;
  const rows = studios.map((l) => ({
    id: l.id,
    label: l.shortName,
    cents: resolveClassPriceCents({ sessionType: st, locationId: l.id }),
    unconfirmed: st.locationPrices.some((p) => p.locationId === l.id && !p.isConfirmed),
  }));
  const allSame = rows.every((r) => r.cents === rows[0]?.cents && !r.unconfirmed);

  if (rows.length === 0 || allSame) {
    return <>{money(rows[0]?.cents ?? st.dropInPriceCents)}</>;
  }
  return (
    <Stack spacing={0.25}>
      {rows.map((r) => (
        <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
            {r.label}
          </Typography>
          <Typography variant="body2">{r.cents > 0 ? money(r.cents) : '—'}</Typography>
          {r.unconfirmed && <Chip label="unconfirmed" size="small" color="warning" variant="outlined" />}
        </Box>
      ))}
    </Stack>
  );
}

type FilterTab = 'active' | 'archived';

export default function ClassTypesPage() {
  const { locations, selectedLocationId } = useLocationFilter();
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<SessionType | null>(null);
  const [editTarget, setEditTarget] = useState<SessionType | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url =
      selectedLocationId === ALL_LOCATIONS
        ? '/api/admin/session-types'
        : `/api/admin/session-types?locationId=${selectedLocationId}`;
    fetch(url)
      .then((r) => r.json())
      .then(setSessionTypes)
      .finally(() => setLoading(false));
  }, [selectedLocationId]);

  const active = sessionTypes.filter((st) => !isArchived(st));
  const archived = sessionTypes.filter(isArchived);
  const visible = tab === 'active' ? active : archived;

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(st: SessionType) {
    setEditTarget(st);
    setForm(toForm(st));
    setFormError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setStudioPrice(locationId: string, patch: Partial<StudioPriceForm>) {
    setForm((prev) => ({
      ...prev,
      studioPrices: {
        ...prev.studioPrices,
        [locationId]: { ...(prev.studioPrices[locationId] ?? BLANK_STUDIO_PRICE), ...patch },
      },
    }));
  }

  async function handleSave() {
    setFormError(null);

    const dropInPriceCents = toCents(form.dropInPriceDollars);
    const memberPriceCents = toCents(form.memberPriceDollars);
    if (!form.name.trim()) return setFormError('Name is required');
    if (dropInPriceCents === null || Number.isNaN(dropInPriceCents)) return setFormError('Enter a default price (0 is fine)');
    if (Number.isNaN(memberPriceCents)) return setFormError('Member price must be a dollar amount, or blank');

    // Per-studio prices only apply to a class that runs at every studio.
    const locationPrices: LocationPrice[] = [];
    if (form.locationId === EVERY_STUDIO) {
      for (const loc of locations) {
        const row = form.studioPrices[loc.id];
        if (!row) continue;
        const priceCents = toCents(row.priceDollars);
        const studioMemberCents = toCents(row.memberPriceDollars);
        if (Number.isNaN(priceCents) || Number.isNaN(studioMemberCents))
          return setFormError(`${loc.shortName}: prices must be dollar amounts, or blank`);
        if (priceCents === null) {
          if (studioMemberCents !== null) return setFormError(`${loc.shortName}: a member price needs a regular price too`);
          continue;
        }
        locationPrices.push({
          locationId: loc.id,
          priceCents,
          memberPriceCents: studioMemberCents,
          isConfirmed: row.isConfirmed,
        });
      }
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      durationMinutes: Number(form.durationMinutes),
      capacity: Number(form.capacity),
      dropInPriceCents,
      memberPriceCents,
      priceUnit: form.priceUnit,
      locationPrices,
      maxPeoplePerWheel: Number(form.maxPeoplePerWheel),
      allowsWheelSharing: form.allowsWheelSharing,
      isTicketEligible: form.isTicketEligible,
      membersOnly: form.membersOnly,
      isPublic: form.isPublic,
      minAge: form.minAge.trim() === '' ? null : Number(form.minAge),
      maxAge: form.maxAge.trim() === '' ? null : Number(form.maxAge),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      isBusyWindow: form.isBusyWindow,
      isTemplate: form.isTemplate,
      locationId: form.locationId === EVERY_STUDIO ? null : form.locationId,
    };

    setSaving(true);
    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/session-types/${editTarget.id}` : '/api/admin/session-types';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setFormError(data.error ?? 'Save failed');
      setSaving(false);
      return;
    }

    const saved = (await res.json()) as SessionType;
    if (isEdit) {
      setSessionTypes((prev) => prev.map((st) => (st.id === saved.id ? saved : st)));
    } else {
      setSessionTypes((prev) => [...prev, saved]);
    }
    setDialogOpen(false);
    setSaving(false);
  }

  // Class types are never deleted: history (sessions, bookings, orders) points at them.
  async function setArchived(st: SessionType, archivedNow: boolean) {
    setArchiveTarget(null);
    setListError(null);
    const res = await fetch(`/api/admin/session-types/${st.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: archivedNow }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setListError(data.error ?? (archivedNow ? 'Could not archive' : 'Could not restore'));
      return;
    }
    const saved = (await res.json()) as SessionType;
    setSessionTypes((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
  }

  const yesNo = (value: boolean) => (
    <Typography variant="body2" color={value ? 'text.primary' : 'text.secondary'}>
      {value ? 'Yes' : 'No'}
    </Typography>
  );

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>
            Class Types
          </Typography>
          <Typography variant="body2" color="text.secondary">
            What the studio offers. Dated cohorts, workshop topics and private groups are sessions on the
            schedule, not class types.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          New class type
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, mt: 2 }}>
        <Tab label={`Active (${active.length})`} value="active" />
        <Tab label={`Archived (${archived.length})`} value="archived" />
      </Tabs>

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Ticket eligible</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Members only</TableCell>
                <TableCell>Upcoming</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No class types here
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((st) => (
                  <TableRow
                    key={st.id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openEdit(st)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{st.name}</Typography>
                      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                        {st.location && (
                          <Typography variant="caption" color="text.secondary">
                            {st.location.name} only
                          </Typography>
                        )}
                        {st.isBusyWindow && <Chip label="Internal block" size="small" variant="outlined" />}
                        {st.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{KIND_LABELS[st.kind] ?? st.kind}</TableCell>
                    <TableCell>
                      <PriceCell st={st} locations={locations} />
                      {st.memberPriceCents !== null && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          members {money(st.memberPriceCents)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{UNIT_LABELS[st.priceUnit] ?? st.priceUnit}</TableCell>
                    <TableCell>{yesNo(st.isTicketEligible)}</TableCell>
                    <TableCell>
                      <Chip
                        label={st.isPublic ? 'Public' : 'Private'}
                        size="small"
                        color={st.isPublic ? 'success' : 'default'}
                        variant={st.isPublic ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>{yesNo(st.membersOnly)}</TableCell>
                    <TableCell>{st._count.studioSessions}</TableCell>
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isArchived(st) ? (
                        <Button size="small" onClick={() => setArchived(st, false)}>
                          Restore
                        </Button>
                      ) : (
                        <Tooltip title="Hides it everywhere. Nothing is deleted.">
                          <Button size="small" color="error" onClick={() => setArchiveTarget(st)}>
                            Archive
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editTarget ? 'Edit class type' : 'New class type'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {editTarget && isArchived(editTarget) && (
              <Alert severity="info">Archived. Restore it from the list to schedule or sell it again.</Alert>
            )}
            <TextField
              id="ct-name"
              label="Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
            <TextField
              id="ct-desc"
              label="Description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              multiline
              rows={2}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="ct-kind-label">Kind</InputLabel>
                  <Select
                    labelId="ct-kind-label"
                    label="Kind"
                    value={form.kind}
                    onChange={(e) => setField('kind', e.target.value)}
                  >
                    <MenuItem value="EVENT">Event (one session)</MenuItem>
                    <MenuItem value="COURSE">Course (several sessions)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="ct-location-label" shrink>Studio</InputLabel>
                  <Select
                    labelId="ct-location-label"
                    label="Studio"
                    displayEmpty
                    notched
                    value={form.locationId}
                    onChange={(e) => setField('locationId', e.target.value)}
                  >
                    <MenuItem value={EVERY_STUDIO}>Every studio</MenuItem>
                    {locations.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id}>{loc.name} only</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-duration"
                  label="Duration (min)"
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { min: 15 } }}
                  value={form.durationMinutes}
                  onChange={(e) => setField('durationMinutes', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-capacity"
                  label="Capacity"
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={form.capacity}
                  onChange={(e) => setField('capacity', e.target.value)}
                />
              </Grid>
            </Grid>

            <Divider>Price</Divider>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <TextField
                  id="ct-price"
                  label="Default price ($)"
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  value={form.dropInPriceDollars}
                  onChange={(e) => setField('dropInPriceDollars', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  id="ct-member-price"
                  label="Member price ($)"
                  type="number"
                  fullWidth
                  placeholder="Same"
                  slotProps={{ htmlInput: { min: 0, step: 0.01 }, inputLabel: { shrink: true } }}
                  value={form.memberPriceDollars}
                  onChange={(e) => setField('memberPriceDollars', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="ct-unit-label">Price buys</InputLabel>
                  <Select
                    labelId="ct-unit-label"
                    label="Price buys"
                    value={form.priceUnit}
                    onChange={(e) => setField('priceUnit', e.target.value)}
                  >
                    <MenuItem value="PER_PERSON">One person</MenuItem>
                    <MenuItem value="PER_WHEEL">One wheel</MenuItem>
                    <MenuItem value="FLAT">The whole booking</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              A class at $0 is never sold as a drop-in. Workshops stay at $0 here and are priced on each session.
            </Typography>

            {form.locationId === EVERY_STUDIO && locations.map((loc) => {
              const row = form.studioPrices[loc.id] ?? BLANK_STUDIO_PRICE;
              return (
                <Grid container spacing={2} key={loc.id} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      label={`${loc.shortName} price ($)`}
                      type="number"
                      size="small"
                      fullWidth
                      placeholder="Default"
                      slotProps={{ htmlInput: { min: 0, step: 0.01 }, inputLabel: { shrink: true } }}
                      value={row.priceDollars}
                      onChange={(e) => setStudioPrice(loc.id, { priceDollars: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      label={`${loc.shortName} member ($)`}
                      type="number"
                      size="small"
                      fullWidth
                      placeholder="Same"
                      slotProps={{ htmlInput: { min: 0, step: 0.01 }, inputLabel: { shrink: true } }}
                      value={row.memberPriceDollars}
                      onChange={(e) => setStudioPrice(loc.id, { memberPriceDollars: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={row.isConfirmed}
                          disabled={row.priceDollars.trim() === ''}
                          onChange={(e) => setStudioPrice(loc.id, { isConfirmed: e.target.checked })}
                        />
                      }
                      label="Confirmed"
                    />
                  </Grid>
                </Grid>
              );
            })}

            {form.priceUnit === 'PER_WHEEL' && (
              <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    id="ct-per-wheel"
                    label="People per wheel (max)"
                    type="number"
                    fullWidth
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.maxPeoplePerWheel}
                    onChange={(e) => setField('maxPeoplePerWheel', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.allowsWheelSharing}
                        onChange={(e) => setField('allowsWheelSharing', e.target.checked)}
                      />
                    }
                    label="Wheel can be shared"
                  />
                </Grid>
              </Grid>
            )}

            <Divider>Who can book it</Divider>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isTicketEligible}
                  onChange={(e) => setField('isTicketEligible', e.target.checked)}
                />
              }
              label="Members can book it with a class ticket"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.membersOnly}
                  onChange={(e) => setField('membersOnly', e.target.checked)}
                />
              }
              label="Members only (never sold as a drop-in)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isPublic}
                  onChange={(e) => setField('isPublic', e.target.checked)}
                />
              }
              label="Public (shows on the public schedule and in the POS)"
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-min-age"
                  label="Minimum age"
                  type="number"
                  fullWidth
                  placeholder="None"
                  slotProps={{ htmlInput: { min: 0 }, inputLabel: { shrink: true } }}
                  value={form.minAge}
                  onChange={(e) => setField('minAge', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  id="ct-max-age"
                  label="Maximum age"
                  type="number"
                  fullWidth
                  placeholder="None"
                  slotProps={{ htmlInput: { min: 0 }, inputLabel: { shrink: true } }}
                  value={form.maxAge}
                  onChange={(e) => setField('maxAge', e.target.value)}
                />
              </Grid>
            </Grid>
            <TextField
              id="ct-tags"
              label="Tags"
              placeholder="date-night, bachelorette"
              helperText="Comma separated. Tags are landing pages and filters, not separate class types."
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.tags}
              onChange={(e) => setField('tags', e.target.value)}
            />

            <Divider>Scheduling</Divider>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isTemplate}
                  onChange={(e) => setField('isTemplate', e.target.checked)}
                />
              }
              label="Reusable template (shows in the schedule's template picker)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isBusyWindow}
                  onChange={(e) => setField('isBusyWindow', e.target.checked)}
                />
              }
              label="Internal block (busy window) — never sellable"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive confirmation */}
      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Archive &ldquo;{archiveTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            It disappears from the schedule picker, the public schedule and the POS. Past sessions,
            bookings and orders keep it, and you can restore it from the Archived tab.
            {archiveTarget && archiveTarget._count.studioSessions > 0 && (
              <>
                {' '}
                Its {archiveTarget._count.studioSessions} upcoming session
                {archiveTarget._count.studioSessions === 1 ? '' : 's'} will be hidden and can&apos;t be booked.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setArchiveTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => archiveTarget && setArchived(archiveTarget, true)}
          >
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
