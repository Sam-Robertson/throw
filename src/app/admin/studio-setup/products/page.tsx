'use client';

import { useEffect, useMemo, useState } from 'react';
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
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  inventory: number;
  imageUrl: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  description: string;
  priceDollars: string;
  sku: string;
  inventory: string;
  imageUrl: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  priceDollars: '',
  sku: '',
  inventory: '0',
  imageUrl: '',
  isActive: true,
};

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    priceDollars: (p.priceCents / 100).toFixed(2),
    sku: p.sku ?? '',
    inventory: String(p.inventory),
    imageUrl: p.imageUrl ?? '',
    isActive: p.isActive,
  };
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
function RowMenu({ product, onEdit, onDelete, onToggleActive }: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
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
        <MenuItem onClick={() => { setAnchor(null); onToggleActive(); }} sx={{ fontSize: '0.875rem' }}>
          <ListItemIcon><VisibilityOffOutlinedIcon fontSize="small" /></ListItemIcon>
          {product.isActive ? 'Deactivate' : 'Activate'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); onDelete(); }} sx={{ fontSize: '0.875rem', color: 'error.main' }}>
          <ListItemIcon><DeleteOutlinedIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          Delete product
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
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
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
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [products, search]);

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
    const priceCents = Math.round(parseFloat(form.priceDollars) * 100);
    if (!form.name.trim() || isNaN(priceCents)) {
      setError('Name and price are required');
      setSaving(false);
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      priceCents,
      sku: form.sku.trim() || undefined,
      inventory: parseInt(form.inventory, 10) || 0,
      imageUrl: form.imageUrl.trim() || undefined,
      isActive: form.isActive,
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

  async function handleDelete(p: Product) {
    setDeleteTarget(null);
    await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
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
        <Typography variant="h2" sx={{ fontWeight: 700 }}>Retail products</Typography>
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
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 100 }}>Price</TableCell>
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
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    onClick={() => openEdit(p)}
                    sx={{
                      cursor: 'pointer',
                      opacity: p.isActive ? 1 : 0.5,
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
                        {!p.isActive && (
                          <Chip label="Inactive" size="small" variant="outlined" sx={{ width: 'fit-content', height: 16, fontSize: '0.65rem' }} />
                        )}
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
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        ${(p.priceCents / 100).toFixed(2)}
                      </Typography>
                    </TableCell>

                    {/* Stock stepper */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StockPill value={p.inventory} onAdjust={(d) => handleStockAdjust(p, d)} />
                    </TableCell>

                    {/* Row menu */}
                    <TableCell padding="checkbox" sx={{ pr: 1 }} onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        product={p}
                        onEdit={() => openEdit(p)}
                        onDelete={() => setDeleteTarget(p)}
                        onToggleActive={() => handleToggleActive(p)}
                      />
                    </TableCell>
                  </TableRow>
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
                  label="Price ($)"
                  required
                  type="number"
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  value={form.priceDollars}
                  onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
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

            <TextField
              label="Inventory / Stock count"
              type="number"
              slotProps={{ htmlInput: { min: 0 } }}
              value={form.inventory}
              onChange={(e) => setForm({ ...form, inventory: e.target.value })}
              helperText="Set to 0 if you don't track inventory for this product."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
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

      {/* ── Delete confirmation ── */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
