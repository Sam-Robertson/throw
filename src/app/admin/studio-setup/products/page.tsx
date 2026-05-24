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
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  inventory: number;
  isActive: boolean;
}

interface FormState {
  name: string;
  description: string;
  priceDollars: string;
  sku: string;
  inventory: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  priceDollars: '0.00',
  sku: '',
  inventory: '0',
  isActive: true,
};

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    priceDollars: (p.priceCents / 100).toFixed(2),
    sku: p.sku ?? '',
    inventory: String(p.inventory),
    isActive: p.isActive,
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      priceCents: Math.round(parseFloat(form.priceDollars) * 100),
      sku: form.sku.trim() || undefined,
      inventory: parseInt(form.inventory, 10) || 0,
      isActive: form.isActive,
    };

    if (!payload.name) { setError('Name is required'); setSaving(false); return; }

    const isEdit = editTarget !== null;
    const url = isEdit ? `/api/admin/products/${editTarget.id}` : '/api/admin/products';
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

  async function handleDelete(p: Product) {
    setDeleteTarget(null);
    await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>Retail Products</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Physical and digital products sold at the studio.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New Product</Button>
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Inventory</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>No products yet</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id} sx={{ cursor: 'pointer' }} onClick={() => openEdit(p)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                      {p.description && (
                        <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>${(p.priceCents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {p.sku ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{p.inventory}</TableCell>
                    <TableCell>
                      <Chip
                        label={p.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={p.isActive ? 'success' : 'default'}
                        variant={p.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" color="error" onClick={() => setDeleteTarget(p)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={2}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Price ($)"
                  type="number"
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  value={form.priceDollars}
                  onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Inventory"
                  type="number"
                  slotProps={{ htmlInput: { min: 0 } }}
                  value={form.inventory}
                  onChange={(e) => setForm({ ...form, inventory: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              label="SKU (optional)"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
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
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
