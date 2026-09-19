'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
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
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SearchIcon from '@mui/icons-material/Search';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';

import { STUDIO_TIMEZONE } from '@/lib/timezone';

// ── Types (rows of the DiscountCode table) ────────────────────────────────
type DiscountType = 'percent' | 'fixed_cents';
type Scope = 'EVERYTHING' | 'RETAIL' | 'PIECES' | 'CLASSES';
type AppliesVia = 'CODE' | 'STAFF' | 'AUTOMATIC';

interface Discount {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  type: DiscountType;
  value: number;
  scope: Scope;
  appliesVia: AppliesVia;
  autoCommitmentMonths: number | null;
  sessionTypeId: string | null;
  productSlug: string | null;
  maxUnits: number | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomerPerYear: number | null;
  requiresNote: boolean;
  requiresGroupEvent: boolean;
  locationId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  archivedAt: string | null;
  sessionType: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

interface Options {
  sessionTypes: { id: string; name: string }[];
  products: { slug: string; name: string; category: string }[];
  locations: { id: string; name: string }[];
}

const SCOPE_LABELS: Record<Scope, string> = {
  EVERYTHING: 'Everything (except gift cards)',
  RETAIL: 'Retail only (never clay or firing)',
  PIECES: 'Pieces only',
  CLASSES: 'Classes',
};

const VIA_LABELS: Record<AppliesVia, string> = {
  CODE: 'Promo code',
  STAFF: 'Staff applied',
  AUTOMATIC: 'Automatic (member commitment)',
};

const VIA_HELP: Record<AppliesVia, string> = {
  CODE: 'Customers type it at online class checkout; staff can type it in the POS.',
  STAFF: 'Shows in the POS discount list for staff to apply.',
  AUTOMATIC: 'Applies by itself in the POS when a member with this commitment is on the order.',
};

interface FormState {
  code: string;
  name: string;
  description: string;
  type: DiscountType;
  value: string;
  scope: Scope;
  appliesVia: AppliesVia;
  autoCommitmentMonths: string;
  sessionTypeId: string;
  productSlug: string;
  maxUnits: string;
  maxUses: string;
  maxUsesPerCustomerPerYear: string;
  requiresNote: boolean;
  requiresGroupEvent: boolean;
  locationId: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  code: '',
  name: '',
  description: '',
  type: 'percent',
  value: '',
  scope: 'CLASSES',
  appliesVia: 'CODE',
  autoCommitmentMonths: '',
  sessionTypeId: '',
  productSlug: '',
  maxUnits: '',
  maxUses: '',
  maxUsesPerCustomerPerYear: '',
  requiresNote: false,
  requiresGroupEvent: false,
  locationId: '',
  validFrom: '',
  validUntil: '',
  isActive: true,
};

// Dates are whole studio days: a code starts at 12:00 am and ends at 11:59 pm Mountain Time.
function toDateInput(iso: string | null): string {
  return iso ? formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'yyyy-MM-dd') : '';
}

function fromDateInput(value: string, endOfDay: boolean): string | null {
  if (!value) return null;
  return fromZonedTime(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`, STUDIO_TIMEZONE).toISOString();
}

function toForm(d: Discount): FormState {
  return {
    code: d.code,
    name: d.name ?? '',
    description: d.description ?? '',
    type: d.type,
    value: d.type === 'percent' ? String(d.value) : (d.value / 100).toFixed(2),
    scope: d.scope,
    appliesVia: d.appliesVia,
    autoCommitmentMonths: d.autoCommitmentMonths != null ? String(d.autoCommitmentMonths) : '',
    sessionTypeId: d.sessionTypeId ?? '',
    productSlug: d.productSlug ?? '',
    maxUnits: d.maxUnits != null ? String(d.maxUnits) : '',
    maxUses: d.maxUses != null ? String(d.maxUses) : '',
    maxUsesPerCustomerPerYear: d.maxUsesPerCustomerPerYear != null ? String(d.maxUsesPerCustomerPerYear) : '',
    requiresNote: d.requiresNote,
    requiresGroupEvent: d.requiresGroupEvent,
    locationId: d.locationId ?? '',
    validFrom: toDateInput(d.validFrom),
    validUntil: toDateInput(d.validUntil),
    isActive: d.isActive,
  };
}

function formatDiscount(d: Discount) {
  return d.type === 'percent' ? `${d.value}% off` : `$${(d.value / 100).toFixed(2)} off`;
}

function formatDates(d: Discount) {
  const fmt = (iso: string) => formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'MMM d, yyyy');
  if (d.validFrom && d.validUntil) return `${fmt(d.validFrom)} – ${fmt(d.validUntil)}`;
  if (d.validFrom) return `From ${fmt(d.validFrom)}`;
  if (d.validUntil) return `Until ${fmt(d.validUntil)}`;
  return 'No dates';
}

type Status = 'Archived' | 'Inactive' | 'Scheduled' | 'Expired' | 'Used up' | 'Active';

function statusOf(d: Discount): Status {
  const now = Date.now();
  if (d.archivedAt) return 'Archived';
  if (!d.isActive) return 'Inactive';
  if (d.validFrom && new Date(d.validFrom).getTime() > now) return 'Scheduled';
  if (d.validUntil && new Date(d.validUntil).getTime() < now) return 'Expired';
  if (d.maxUses != null && d.usedCount >= d.maxUses) return 'Used up';
  return 'Active';
}

/** "Kickstart only · 1 unit · once per customer per year · note required" */
function limitsOf(d: Discount, options: Options): string[] {
  const limits: string[] = [];
  if (d.sessionType) limits.push(`${d.sessionType.name} only`);
  if (d.productSlug) {
    limits.push(`${options.products.find((p) => p.slug === d.productSlug)?.name ?? d.productSlug} only`);
  }
  if (d.maxUnits != null) limits.push(`${d.maxUnits} unit${d.maxUnits === 1 ? '' : 's'} per use`);
  if (d.maxUsesPerCustomerPerYear != null) limits.push(`${d.maxUsesPerCustomerPerYear}× per customer per year`);
  if (d.autoCommitmentMonths != null) limits.push(`${d.autoCommitmentMonths} month commitment`);
  if (d.requiresNote) limits.push('note required');
  if (d.requiresGroupEvent) limits.push('group event orders only');
  return limits;
}

// ── Row overflow menu ─────────────────────────────────────────────────────
function RowMenu({
  discount,
  onEdit,
  onToggle,
  onCopy,
  onArchive,
}: {
  discount: Discount;
  onEdit: () => void;
  onToggle: () => void;
  onCopy: () => void;
  onArchive: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        sx={{ color: 'text.secondary' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2 } } }}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => { setAnchor(null); onEdit(); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onCopy(); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Copy code
        </MenuItem>
        <Divider />
        {!discount.archivedAt && (
          <MenuItem
            onClick={() => { setAnchor(null); onToggle(); }}
            sx={{ fontSize: '0.875rem', color: discount.isActive ? 'error.main' : 'success.main' }}
          >
            <ListItemIcon>
              <PowerSettingsNewIcon fontSize="small" sx={{ color: discount.isActive ? 'error.main' : 'success.main' }} />
            </ListItemIcon>
            {discount.isActive ? 'Deactivate' : 'Activate'}
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAnchor(null); onArchive(); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon>
            {discount.archivedAt ? <UnarchiveOutlinedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          {discount.archivedAt ? 'Restore' : 'Archive'}
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function DiscountCodesPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [options, setOptions] = useState<Options>({ sessionTypes: [], products: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Discount | null>(null);

  // Create / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Discount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch('/api/admin/discount-codes');
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed to load discounts');
    } else {
      const data = await res.json() as { discounts: Discount[]; options: Options };
      setDiscounts(data.discounts);
      setOptions(data.options);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const visible = discounts.filter((d) => showArchived || !d.archivedAt);
    if (!q) return visible;
    return visible.filter((d) =>
      d.code.toLowerCase().includes(q) ||
      d.name?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q),
    );
  }, [discounts, search, showArchived]);
  const archivedCount = discounts.filter((d) => d.archivedAt).length;

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(d: Discount) {
    setEditTarget(d);
    setForm(toForm(d));
    setFormError(null);
    setDialogOpen(true);
  }

  async function patch(d: Discount, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/discount-codes/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json() as Discount;
      setDiscounts((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Update failed');
    }
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    const value = parseFloat(form.value);
    if (!form.code.trim() || isNaN(value) || value <= 0) {
      setFormError('Code and discount amount are required');
      setSaving(false);
      return;
    }
    const optionalInt = (s: string) => (s.trim() ? parseInt(s, 10) : null);

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      type: form.type,
      // percent: whole percent; fixed: dollars → cents
      value: form.type === 'percent' ? Math.round(value) : Math.round(value * 100),
      scope: form.scope,
      appliesVia: form.appliesVia,
      autoCommitmentMonths: form.appliesVia === 'AUTOMATIC' ? optionalInt(form.autoCommitmentMonths) : null,
      sessionTypeId: form.sessionTypeId || null,
      productSlug: form.productSlug || null,
      maxUnits: optionalInt(form.maxUnits),
      maxUses: optionalInt(form.maxUses),
      maxUsesPerCustomerPerYear: optionalInt(form.maxUsesPerCustomerPerYear),
      requiresNote: form.requiresNote,
      requiresGroupEvent: form.requiresGroupEvent,
      locationId: form.locationId || null,
      validFrom: fromDateInput(form.validFrom, false),
      validUntil: fromDateInput(form.validUntil, true),
      isActive: form.isActive,
    };

    const isEdit = editTarget !== null;
    const res = await fetch(isEdit ? `/api/admin/discount-codes/${editTarget.id}` : '/api/admin/discount-codes', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setFormError(d.error ?? 'Save failed');
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  const headCell = { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' };

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Discounts</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Promo codes, staff discounts and automatic member discounts. They apply in the POS and at online class
            checkout. Sales tax is worked out after the discount.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          New discount
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Search toolbar ── */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search discounts…"
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
            sx={{ width: { xs: '100%', sm: 280 } }}
          />
          {archivedCount > 0 && (
            <FormControlLabel
              sx={{ ml: 2 }}
              control={<Switch size="small" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
              label={<Typography variant="body2" color="text.secondary">Show archived ({archivedCount})</Typography>}
            />
          )}
        </Box>

        {/* ── Table ── */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCell, pl: 2 }}>Code</TableCell>
                <TableCell sx={headCell}>Discount</TableCell>
                <TableCell sx={headCell}>Applies to</TableCell>
                <TableCell sx={headCell}>How</TableCell>
                <TableCell sx={headCell}>Dates</TableCell>
                <TableCell sx={headCell}>Used</TableCell>
                <TableCell sx={headCell}>Status</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <LocalOfferOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search ? 'No discounts match your search' : 'No discounts yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const status = statusOf(d);
                  const limits = limitsOf(d, options);
                  return (
                    <TableRow
                      key={d.id}
                      hover
                      onClick={() => openEdit(d)}
                      sx={{ cursor: 'pointer', opacity: status === 'Active' || status === 'Scheduled' ? 1 : 0.55, '& td': { py: 1.25 } }}
                    >
                      <TableCell sx={{ pl: 2 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{d.code}</Typography>
                          <Tooltip title={copied === d.code ? 'Copied' : 'Copy code'}>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyCode(d.code); }}>
                              <ContentCopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                        {d.name && <Typography variant="caption" color="text.secondary">{d.name}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDiscount(d)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{SCOPE_LABELS[d.scope] ?? d.scope}</Typography>
                        {(limits.length > 0 || d.location) && (
                          <Typography variant="caption" color="text.secondary">
                            {[d.location ? `${d.location.name} only` : null, ...limits].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{VIA_LABELS[d.appliesVia] ?? d.appliesVia}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={d.validFrom || d.validUntil ? undefined : 'text.disabled'}>
                          {formatDates(d)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {d.usedCount}{d.maxUses != null ? ` / ${d.maxUses}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={status}
                          size="small"
                          color={status === 'Active' ? 'success' : status === 'Scheduled' ? 'info' : 'default'}
                          variant={status === 'Active' ? 'filled' : 'outlined'}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell padding="checkbox" sx={{ pr: 1 }} onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          discount={d}
                          onEdit={() => openEdit(d)}
                          onCopy={() => copyCode(d.code)}
                          onToggle={() => void patch(d, { isActive: !d.isActive })}
                          onArchive={() => (d.archivedAt ? void patch(d, { archived: false }) : setArchiveTarget(d))}
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

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editTarget ? `Edit ${editTarget.code}` : 'New discount'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stack spacing={2.5}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Code"
                  required
                  fullWidth
                  value={form.code}
                  disabled={editTarget !== null && editTarget.usedCount > 0}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                  helperText={editTarget && editTarget.usedCount > 0 ? "Used codes can't be renamed." : 'Not case sensitive.'}
                  autoFocus={!editTarget}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField
                  label="Name"
                  fullWidth
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  helperText="Shown to staff in the POS and on receipts."
                />
              </Grid>
            </Grid>

            <TextField
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={2}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })}
                >
                  <MenuItem value="percent">Percent off</MenuItem>
                  <MenuItem value="fixed_cents">Dollar amount off</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={form.type === 'percent' ? 'Percent' : 'Amount'}
                  required
                  fullWidth
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  slotProps={{
                    htmlInput: form.type === 'percent' ? { min: 1, max: 100, step: 1 } : { min: 0.01, step: 0.01 },
                    input: {
                      startAdornment: form.type === 'fixed_cents' ? <InputAdornment position="start">$</InputAdornment> : undefined,
                      endAdornment: form.type === 'percent' ? <InputAdornment position="end">%</InputAdornment> : undefined,
                    },
                  }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Applies to"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}
                >
                  {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                    <MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="How it's applied"
                  value={form.appliesVia}
                  onChange={(e) => setForm({ ...form, appliesVia: e.target.value as AppliesVia })}
                >
                  {(Object.keys(VIA_LABELS) as AppliesVia[]).map((v) => (
                    <MenuItem key={v} value={v}>{VIA_LABELS[v]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: '-8px !important' }}>
              {VIA_HELP[form.appliesVia]}
            </Typography>

            {form.appliesVia === 'AUTOMATIC' && (
              <TextField
                label="Commitment length (months)"
                required
                type="number"
                slotProps={{ htmlInput: { min: 1 } }}
                value={form.autoCommitmentMonths}
                onChange={(e) => setForm({ ...form, autoCommitmentMonths: e.target.value })}
                helperText="A member gets the single longest-commitment discount they qualify for."
              />
            )}

            <Divider />
            <Typography variant="subtitle2">Limits</Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Class type"
                  value={form.sessionTypeId}
                  onChange={(e) => setForm({ ...form, sessionTypeId: e.target.value })}
                  helperText="Only this class type."
                >
                  <MenuItem value="">Any class type</MenuItem>
                  {/* Keep an archived or inactive type selectable on the discount that already has it. */}
                  {editTarget?.sessionType && !options.sessionTypes.some((t) => t.id === editTarget.sessionType!.id) && (
                    <MenuItem value={editTarget.sessionType.id}>{editTarget.sessionType.name}</MenuItem>
                  )}
                  {options.sessionTypes.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Product"
                  value={form.productSlug}
                  onChange={(e) => setForm({ ...form, productSlug: e.target.value })}
                  helperText="Only this product."
                >
                  <MenuItem value="">Any product</MenuItem>
                  {form.productSlug && !options.products.some((p) => p.slug === form.productSlug) && (
                    <MenuItem value={form.productSlug}>{form.productSlug}</MenuItem>
                  )}
                  {options.products.map((p) => (
                    <MenuItem key={p.slug} value={p.slug}>{p.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Max units"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={form.maxUnits}
                  onChange={(e) => setForm({ ...form, maxUnits: e.target.value })}
                  helperText="Items discounted per use (one piece, one wheel)."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Max uses"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  helperText={editTarget ? `Used ${editTarget.usedCount} so far.` : 'In total. Blank = no limit.'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Per customer per year"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={form.maxUsesPerCustomerPerYear}
                  onChange={(e) => setForm({ ...form, maxUsesPerCustomerPerYear: e.target.value })}
                  helperText="Needs a customer on the order."
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  label="Studio"
                  value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                >
                  <MenuItem value="">All studios</MenuItem>
                  {options.locations.map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Start date"
                  fullWidth
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Blank = already started."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="End date"
                  fullWidth
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Last day it works. Blank = no end."
                />
              </Grid>
            </Grid>

            <Stack>
              <FormControlLabel
                control={<Switch checked={form.requiresNote} onChange={(e) => setForm({ ...form, requiresNote: e.target.checked })} />}
                label="Staff must add a note"
              />
              <FormControlLabel
                control={<Switch checked={form.requiresGroupEvent} onChange={(e) => setForm({ ...form, requiresGroupEvent: e.target.checked })} />}
                label="Only on orders tied to a group event"
              />
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                label="Active"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create discount'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Archive confirmation ── */}
      <Dialog open={archiveTarget !== null} onClose={() => setArchiveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Archive {archiveTarget?.code}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            It stops working everywhere and leaves this list. Past uses are kept, and you can restore it from
            &ldquo;Show archived&rdquo;.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setArchiveTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (archiveTarget) void patch(archiveTarget, { archived: true });
              setArchiveTarget(null);
            }}
          >
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
