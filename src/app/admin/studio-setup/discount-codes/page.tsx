'use client';

import { useEffect, useMemo, useState } from 'react';
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
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SearchIcon from '@mui/icons-material/Search';

// ── Types mirroring Stripe SDK v22 PromotionCode shape ───────────────────
interface StripeCoupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  times_redeemed: number;
  valid: boolean;
}

interface StripePromoCode {
  id: string;
  code: string;
  active: boolean;
  // SDK v22: coupon lives inside promotion.coupon (expanded)
  promotion: { coupon: StripeCoupon | null; type: 'coupon' };
  expires_at: number | null;           // unix timestamp
  max_redemptions: number | null;
  times_redeemed: number;
  restrictions: {
    first_time_transaction: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDiscount(code: StripePromoCode) {
  const c = code.promotion.coupon;
  if (!c) return '—';
  if (c.percent_off != null) return `${c.percent_off}% off`;
  if (c.amount_off != null) return `$${(c.amount_off / 100).toFixed(2)} off`;
  return '—';
}

function formatExpiry(ts: number | null) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isExpired(ts: number | null) {
  if (!ts) return false;
  return ts * 1000 < Date.now();
}

// ── Row overflow menu ─────────────────────────────────────────────────────
function RowMenu({
  code,
  onToggle,
  onCopy,
}: {
  code: StripePromoCode;
  onToggle: () => void;
  onCopy: () => void;
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
        <MenuItem
          onClick={() => { setAnchor(null); onCopy(); }}
          sx={{ fontSize: '0.875rem' }}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Copy code
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => { setAnchor(null); onToggle(); }}
          sx={{ fontSize: '0.875rem', color: code.active ? 'error.main' : 'success.main' }}
        >
          <ListItemIcon>
            <PowerSettingsNewIcon fontSize="small" sx={{ color: code.active ? 'error.main' : 'success.main' }} />
          </ListItemIcon>
          {code.active ? 'Deactivate' : 'Reactivate'}
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<StripePromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Toggle confirm dialog
  const [toggleTarget, setToggleTarget] = useState<StripePromoCode | null>(null);
  const [toggling, setToggling] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discountType: 'percent' as 'percent' | 'fixed',
    discountValue: '',
    expiresAt: '',
    maxRedemptions: '',
    firstTimeOnly: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/discount-codes');
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Failed to load discount codes');
    } else {
      setCodes(await res.json() as StripePromoCode[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return codes;
    return codes.filter((c) =>
      c.code.toLowerCase().includes(q) ||
      c.promotion.coupon?.name?.toLowerCase().includes(q),
    );
  }, [codes, search]);

  async function handleToggle(code: StripePromoCode) {
    setToggling(true);
    const res = await fetch(`/api/admin/discount-codes/${code.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !code.active }),
    });
    if (res.ok) {
      const updated = await res.json() as StripePromoCode;
      setCodes((prev) => prev.map((c) => c.id === updated.id ? { ...c, active: updated.active } : c));
    }
    setToggleTarget(null);
    setToggling(false);
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);

    const value = parseFloat(form.discountValue);
    if (!form.code.trim() || isNaN(value) || value <= 0) {
      setCreateError('Code and discount amount are required');
      setCreating(false);
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      // percent: pass as-is; fixed: convert dollars → cents
      discountValue: form.discountType === 'percent' ? value : Math.round(value * 100),
      expiresAt: form.expiresAt || undefined,
      maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : undefined,
      firstTimeOnly: form.firstTimeOnly,
    };

    const res = await fetch('/api/admin/discount-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setCreateError(d.error ?? 'Failed to create code');
    } else {
      const created = await res.json() as StripePromoCode;
      setCodes((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({ code: '', discountType: 'percent', discountValue: '', expiresAt: '', maxRedemptions: '', firstTimeOnly: false });
    }
    setCreating(false);
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Discount Codes</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Managed via Stripe. Changes sync instantly.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateError(null); setCreateOpen(true); }}>
          Create code
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Search toolbar ── */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder="Search codes…"
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
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        </Box>

        {/* ── Table ── */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', pl: 2 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Discount</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Expires</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textAlign: 'center' }}>Redeemed</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textAlign: 'center' }}>Limit</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Status</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">Loading from Stripe…</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <LocalOfferOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search ? 'No codes match your search' : 'No discount codes yet'}
                    </Typography>
                    {!search && (
                      <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ mt: 2 }}>
                        Create your first code
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((code) => {
                  const expired = isExpired(code.expires_at);
                  const expiry = formatExpiry(code.expires_at);
                  const inactive = !code.active || expired;

                  return (
                    <TableRow
                      key={code.id}
                      hover
                      sx={{ opacity: inactive ? 0.55 : 1, '& td': { py: 1 } }}
                    >
                      {/* Code */}
                      <TableCell sx={{ pl: 2 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.875rem', letterSpacing: '0.04em' }}
                          >
                            {code.code}
                          </Typography>
                          <Tooltip title={copied === code.code ? 'Copied!' : 'Copy code'}>
                            <IconButton
                              size="small"
                              onClick={() => copyCode(code.code)}
                              sx={{ color: copied === code.code ? 'success.main' : 'text.disabled', width: 22, height: 22 }}
                            >
                              <ContentCopyIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                          {code.restrictions.first_time_transaction && (
                            <Tooltip title="First-time customers only">
                              <PersonOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                            </Tooltip>
                          )}
                        </Stack>
                        {code.promotion.coupon?.name && code.promotion.coupon.name !== code.code && (
                          <Typography variant="caption" color="text.disabled">{code.promotion.coupon.name}</Typography>
                        )}
                      </TableCell>

                      {/* Discount */}
                      <TableCell>
                        <Chip
                          label={formatDiscount(code)}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ fontWeight: 700, fontFamily: 'monospace' }}
                        />
                      </TableCell>

                      {/* Expires */}
                      <TableCell>
                        {expiry ? (
                          <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: expired ? 'error.main' : 'text.secondary' }}>
                            {expiry}
                            {expired && ' (expired)'}
                          </Typography>
                        ) : (
                          <Tooltip title="No expiration">
                            <AllInclusiveIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Redeemed */}
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ fontWeight: code.times_redeemed > 0 ? 600 : 400, color: code.times_redeemed > 0 ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
                          {code.times_redeemed > 0 ? code.times_redeemed : '—'}
                        </Typography>
                      </TableCell>

                      {/* Limit */}
                      <TableCell align="center">
                        {code.max_redemptions ? (
                          <Typography variant="body2" sx={{ fontSize: '0.875rem', color: code.times_redeemed >= code.max_redemptions ? 'error.main' : 'text.secondary' }}>
                            {code.times_redeemed} / {code.max_redemptions}
                          </Typography>
                        ) : (
                          <Tooltip title="Unlimited">
                            <AllInclusiveIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {expired ? (
                          <Chip label="Expired" size="small" color="default" variant="outlined" />
                        ) : (
                          <Chip
                            label={code.active ? 'Active' : 'Inactive'}
                            size="small"
                            color={code.active ? 'success' : 'default'}
                            variant={code.active ? 'filled' : 'outlined'}
                          />
                        )}
                      </TableCell>

                      {/* Row menu */}
                      <TableCell padding="checkbox" sx={{ pr: 1 }}>
                        <RowMenu
                          code={code}
                          onToggle={() => setToggleTarget(code)}
                          onCopy={() => copyCode(code.code)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer count */}
        {filtered.length > 0 && (
          <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {filtered.length} code{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
              {' · '}
              {codes.filter((c) => c.active && !isExpired(c.expires_at)).length} active
            </Typography>
          </Box>
        )}
      </Paper>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create discount code</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stack spacing={2.5}>
            {createError && <Alert severity="error">{createError}</Alert>}

            <TextField
              label="Promo code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
              placeholder="e.g. SUMMER25, CLAY50"
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' } } }}
              helperText="Uppercase letters and numbers only. Customers enter this at checkout."
              autoFocus
            />

            <Stack direction="row" spacing={2}>
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="dtype-label">Discount type</InputLabel>
                <Select
                  labelId="dtype-label"
                  value={form.discountType}
                  label="Discount type"
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed', discountValue: '' })}
                >
                  <MenuItem value="percent">Percentage (%)</MenuItem>
                  <MenuItem value="fixed">Fixed amount ($)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={form.discountType === 'percent' ? 'Percent off' : 'Dollars off'}
                required
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                slotProps={{
                  htmlInput: { min: 0.01, max: form.discountType === 'percent' ? 100 : undefined, step: form.discountType === 'percent' ? 1 : 0.01 },
                  input: {
                    startAdornment: form.discountType === 'fixed'
                      ? <InputAdornment position="start">$</InputAdornment>
                      : undefined,
                    endAdornment: form.discountType === 'percent'
                      ? <InputAdornment position="end">%</InputAdornment>
                      : undefined,
                  },
                }}
                sx={{ flex: 1 }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Expiration date (optional)"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Code deactivates at midnight on this date."
                sx={{ flex: 1 }}
              />
              <TextField
                label="Max redemptions (optional)"
                type="number"
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                slotProps={{ htmlInput: { min: 1 } }}
                helperText="Leave blank for unlimited."
                sx={{ flex: 1 }}
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={form.firstTimeOnly}
                  onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>First-time customers only</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stripe will reject this code for returning customers.
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating in Stripe…' : 'Create code'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Toggle confirm ── */}
      <Dialog open={toggleTarget !== null} onClose={() => setToggleTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {toggleTarget?.active ? 'Deactivate' : 'Reactivate'} &ldquo;{toggleTarget?.code}&rdquo;?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toggleTarget?.active
              ? 'Customers will no longer be able to use this code at checkout.'
              : 'This code will become valid for use at checkout again.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setToggleTarget(null)} disabled={toggling}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={toggleTarget?.active ? 'error' : 'primary'}
            onClick={() => toggleTarget && handleToggle(toggleTarget)}
            disabled={toggling}
          >
            {toggling ? 'Saving…' : toggleTarget?.active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
