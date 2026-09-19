'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
import Alert from '@mui/material/Alert';

import AddIcon from '@mui/icons-material/Add';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, PRODUCT_CATEGORY_TAX_CODES, type ProductCategory } from '@/config/taxCodes';

interface Product {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  inventory: number;
  imageUrl: string | null;
  isActive: boolean;
  category: string;
  unit: string;
  isPriced: boolean;
  minChargeCents: number | null;
  membersOnly: boolean;
  trackInventory: boolean;
  classCredits: number | null;
  taxCode: string | null;
  effectiveTaxCode?: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

interface FormState {
  name: string;
  description: string;
  priceDollars: string;
  sku: string;
  inventory: string;
  imageUrl: string;
  isActive: boolean;
  category: ProductCategory;
  unit: 'EACH' | 'LB';
  isPriced: boolean;
  minChargeDollars: string;
  membersOnly: boolean;
  trackInventory: boolean;
  classCredits: string;
  taxCode: string;
  sortOrder: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  priceDollars: '',
  sku: '',
  inventory: '0',
  imageUrl: '',
  isActive: true,
  category: 'RETAIL',
  unit: 'EACH',
  isPriced: true,
  minChargeDollars: '',
  membersOnly: false,
  trackInventory: true,
  classCredits: '',
  taxCode: '',
  sortOrder: '0',
};

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    priceDollars: p.isPriced ? (p.priceCents / 100).toFixed(2) : '',
    sku: p.sku ?? '',
    inventory: String(p.inventory),
    imageUrl: p.imageUrl ?? '',
    isActive: p.isActive,
    category: (PRODUCT_CATEGORIES as readonly string[]).includes(p.category) ? (p.category as ProductCategory) : 'RETAIL',
    unit: p.unit === 'LB' ? 'LB' : 'EACH',
    isPriced: p.isPriced,
    minChargeDollars: p.minChargeCents != null ? (p.minChargeCents / 100).toFixed(2) : '',
    membersOnly: p.membersOnly,
    trackInventory: p.trackInventory,
    classCredits: p.classCredits != null ? String(p.classCredits) : '',
    taxCode: p.taxCode ?? '',
    sortOrder: String(p.sortOrder),
  };
}

function priceLabel(p: Product): string {
  const price = `$${(p.priceCents / 100).toFixed(2)}${p.unit === 'LB' ? ' / lb' : ''}`;
  return p.minChargeCents ? `${price} (min $${(p.minChargeCents / 100).toFixed(2)})` : price;
}

// ── Product thumbnail ─────────────────────────────────────────────────────
function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  if (imageUrl) {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt={name}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        sx={{
          width: 52,
          height: 52,
          objectFit: 'cover',
          borderRadius: 1.5,
          display: 'block',
          bgcolor: 'action.hover',
        }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ImageOutlinedIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
    </Box>
  );
}

// ── Stock pill ────────────────────────────────────────────────────────────
function StockPill({ value, onAdjust }: { value: number; onAdjust: (delta: number) => void }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
      <Tooltip title="Decrease stock">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onAdjust(-1); }}
          disabled={value <= 0}
          sx={{ width: 24, height: 24, border: '1px solid', borderColor: 'divider', borderRadius: '50%', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
        >
          <RemoveIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
      <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center', fontWeight: 500, fontSize: '0.8125rem' }}>
        {value > 0 ? value : <Typography component="span" variant="body2" color="text.disabled">—</Typography>}
      </Typography>
      <Tooltip title="Increase stock">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onAdjust(+1); }}
          sx={{ width: 24, height: 24, border: '1px solid', borderColor: 'divider', borderRadius: '50%', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
        >
          <AddIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

// ── Row menu ──────────────────────────────────────────────────────────────
function RowMenu({ product, onEdit, onArchive, onToggleActive }: {
  product: Product;
  onEdit: () => void;
  onArchive: () => void;
  onToggleActive: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }} sx={{ color: 'text.secondary' }}>
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
          Edit product
        </MenuItem>
        {/* No price yet (OPEN in the catalog) or archived: can't be switched on. */}
        <MenuItem
          disabled={!product.isActive && (!product.isPriced || product.archivedAt !== null)}
          onClick={() => { setAnchor(null); onToggleActive(); }}
          sx={{ fontSize: '0.875rem' }}
        >
          <ListItemIcon><VisibilityOffOutlinedIcon fontSize="small" /></ListItemIcon>
          {product.isActive ? 'Deactivate' : 'Activate'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onArchive(); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon>
            {product.archivedAt ? <UnarchiveOutlinedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          {product.archivedAt ? 'Restore product' : 'Archive product'}
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/products');
    if (res.ok) setProducts(await res.json() as Product[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const visible = products.filter((p) => showArchived || !p.archivedAt);
    if (!q) return visible;
    return visible.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [products, search, showArchived]);

  // One table section per category, in catalog order.
  const groups = useMemo(
    () =>
      PRODUCT_CATEGORIES.map((category) => ({
        category,
        label: PRODUCT_CATEGORY_LABELS[category],
        products: filtered
          .filter((p) => p.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      })).filter((g) => g.products.length > 0),
    [filtered],
  );
  const archivedCount = products.filter((p) => p.archivedAt).length;

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm(toForm(p));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    // A product with no price yet (OPEN in the catalog) is saved at $0, not priced, inactive.
    const priceCents = form.isPriced ? Math.round(parseFloat(form.priceDollars) * 100) : 0;
    if (!form.name.trim() || isNaN(priceCents) || priceCents < 0) {
      setError(form.isPriced ? 'Name and price are required' : 'Name is required');
      setSaving(false);
      return;
    }
    const minChargeCents = form.minChargeDollars.trim() ? Math.round(parseFloat(form.minChargeDollars) * 100) : null;
    const classCredits = form.classCredits.trim() ? parseInt(form.classCredits, 10) : null;
    if ((minChargeCents !== null && (isNaN(minChargeCents) || minChargeCents < 0)) || (classCredits !== null && (isNaN(classCredits) || classCredits < 0))) {
      setError('Minimum charge and class credits must be zero or more');
      setSaving(false);
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceCents,
      sku: form.sku.trim() || null,
      inventory: parseInt(form.inventory, 10) || 0,
      imageUrl: form.imageUrl.trim() || null,
      isActive: form.isPriced && form.isActive,
      category: form.category,
      unit: form.unit,
      isPriced: form.isPriced,
      minChargeCents,
      membersOnly: form.membersOnly,
      trackInventory: form.trackInventory,
      classCredits,
      taxCode: form.taxCode.trim() || null,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/products/${editTarget.id}` : '/api/admin/products';
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? 'Save failed');
    } else {
      setDialogOpen(false);
      await load();
    }
    setSaving(false);
  }

  // Products are archived, never deleted: past orders keep pointing at them.
  async function handleArchive(p: Product, archived: boolean) {
    setArchiveTarget(null);
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    if (res.ok) await load();
  }

  async function handleToggleActive(p: Product) {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) {
      const updated = await res.json() as Product;
      setProducts((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    }
  }

  async function handleStockAdjust(p: Product, delta: number) {
    const newInventory = Math.max(0, p.inventory + delta);
    // Optimistic update
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, inventory: newInventory } : x));
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory: newInventory }),
    });
    if (!res.ok) {
      // Revert
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, inventory: p.inventory } : x));
    }
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* ── Header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>Products</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Create new product
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Search toolbar ── */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search products…"
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
                {/* image col — no label */}
                <TableCell sx={{ width: 68, pl: 2 }} />
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 120 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 190 }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 120 }}>Stock</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <StorefrontOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                      {search ? 'No products match your search' : 'No products yet'}
                    </Typography>
                    {!search && (
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                        Add clay, tools, and retail items your studio sells.
                      </Typography>
                    )}
                    {!search && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={openCreate}
                        sx={{ mt: 2 }}
                      >
                        Create new product
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <Fragment key={group.category}>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ bgcolor: 'action.hover', py: 0.75, pl: 2 }}>
                      <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        {group.label} · {group.products.length}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {group.products.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    onClick={() => openEdit(p)}
                    sx={{
                      cursor: 'pointer',
                      opacity: p.isActive ? 1 : 0.55,
                      '& td': { py: 1 },
                    }}
                  >
                    {/* Thumbnail */}
                    <TableCell sx={{ pl: 2, pr: 1 }}>
                      <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {p.name}
                        </Typography>
                        {p.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {p.description}
                          </Typography>
                        )}
                        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                          {p.archivedAt ? (
                            <Chip label="Archived" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />
                          ) : !p.isPriced ? (
                            <Chip label="Not priced — inactive" size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />
                          ) : !p.isActive ? (
                            <Chip label="Inactive" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />
                          ) : null}
                          {p.membersOnly && <Chip label="Members only" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />}
                          {p.classCredits != null && <Chip label={`${p.classCredits} class credits`} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />}
                        </Stack>
                      </Stack>
                    </TableCell>

                    {/* SKU */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                          color: p.sku ? 'text.secondary' : 'text.disabled',
                        }}
                      >
                        {p.sku ?? '—'}
                      </Typography>
                    </TableCell>

                    {/* Price */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', color: p.isPriced ? undefined : 'text.disabled' }}>
                        {p.isPriced ? priceLabel(p) : 'No price yet'}
                      </Typography>
                    </TableCell>

                    {/* Stock stepper */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {p.trackInventory ? (
                        <StockPill value={p.inventory} onAdjust={(d) => handleStockAdjust(p, d)} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">Not tracked</Typography>
                      )}
                    </TableCell>

                    {/* Row menu */}
                    <TableCell padding="checkbox" sx={{ pr: 1 }} onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        product={p}
                        onEdit={() => openEdit(p)}
                        onArchive={() => (p.archivedAt ? handleArchive(p, false) : setArchiveTarget(p))}
                        onToggleActive={() => handleToggleActive(p)}
                      />
                    </TableCell>
                  </TableRow>
                  ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Row count footer */}
        {filtered.length > 0 && (
          <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? 'Edit product' : 'Create new product'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* Image preview + URL */}
            <Box>
              {form.imageUrl && (
                <Box
                  component="img"
                  src={form.imageUrl}
                  alt="Preview"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 2, mb: 1.5, display: 'block' }}
                />
              )}
              <TextField
                label="Image URL (optional)"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://…"
                fullWidth
                helperText="Paste a direct image link. Leave blank to use a placeholder."
              />
            </Box>

            <TextField
              label="Product name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus={!editTarget}
            />

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
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
                  helperText="Decides the POS tab, the tax code and which discounts apply."
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Sold by"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as 'EACH' | 'LB' })}
                  helperText={form.unit === 'LB' ? 'Staff enter the weight (to 0.1 lb) at the register.' : ' '}
                >
                  <MenuItem value="EACH">Each</MenuItem>
                  <MenuItem value="LB">Pound (by weight)</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={form.isPriced}
                  onChange={(e) => setForm({ ...form, isPriced: e.target.checked, isActive: e.target.checked && form.isActive })}
                />
              }
              label="Has a price"
            />
            {!form.isPriced && (
              <Alert severity="warning">
                Not priced — inactive. This product stays out of the POS until it has a price.
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={form.unit === 'LB' ? 'Price per lb ($)' : 'Price ($)'}
                  required={form.isPriced}
                  disabled={!form.isPriced}
                  type="number"
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  value={form.priceDollars}
                  onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Minimum charge ($, optional)"
                  type="number"
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  value={form.minChargeDollars}
                  onChange={(e) => setForm({ ...form, minChargeDollars: e.target.value })}
                  helperText="Per line, for by-weight products (member firing: $1.00 per piece)."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="SKU (optional)"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                  placeholder="e.g. PCR5, GB1, SCRL"
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={form.trackInventory}
                  onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })}
                />
              }
              label="Track inventory"
            />
            {form.trackInventory && (
              <TextField
                label="Inventory / Stock count"
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                value={form.inventory}
                onChange={(e) => setForm({ ...form, inventory: e.target.value })}
                helperText="The POS won't sell more than this. Turn tracking off for pieces, firing, clay by the pound, packs and shipping."
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={form.membersOnly}
                  onChange={(e) => setForm({ ...form, membersOnly: e.target.checked })}
                />
              }
              label="Members and enrolled students only"
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Class credits"
                  type="number"
                  slotProps={{ htmlInput: { min: 0 } }}
                  value={form.classCredits}
                  onChange={(e) => setForm({ ...form, classCredits: e.target.value })}
                  helperText="Class packs only."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Tax code"
                  value={form.taxCode}
                  onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                  placeholder={PRODUCT_CATEGORY_TAX_CODES[form.category] ?? 'Not taxed'}
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                  helperText="Stripe Tax code. Blank = category default."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  helperText="Lower shows first."
                />
              </Grid>
            </Grid>

            {editTarget?.slug && (
              <TextField
                label="Slug"
                value={editTarget.slug}
                disabled
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                helperText="Read-only. The catalog sync matches products on this."
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={form.isPriced && form.isActive}
                  disabled={!form.isPriced}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
              }
              label="Active (visible to staff at point of sale)"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Archive confirmation ── */}
      <Dialog open={archiveTarget !== null} onClose={() => setArchiveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Archive &ldquo;{archiveTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            It comes off the POS and out of this list. Past orders keep it, and you can restore it any time from
            &ldquo;Show archived&rdquo;.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setArchiveTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => archiveTarget && handleArchive(archiveTarget, true)}>
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
