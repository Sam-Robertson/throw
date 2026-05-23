'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { formatMountainTime } from '@/lib/timezone';

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  activeMembership: string | null;
  membershipStatus: string | null;
  upcomingBookingCount: number;
  lastBookingAt: string | null;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('q', search);
    const res = await fetch(`/api/admin/customers?${params}`);
    if (res.ok) {
      const data = await res.json() as { customers: Customer[]; total: number };
      setCustomers(data.customers);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>Customers</Typography>
        <Typography variant="body2" color="text.secondary">{total} total</Typography>
      </Box>

      {/* Search */}
      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3, display: 'flex', gap: 1, maxWidth: 480 }}>
        <TextField
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1 }}
        />
        <Button type="submit" variant="outlined" size="small">Search</Button>
        {search && (
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={() => { setQ(''); setSearch(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : customers.length === 0 ? (
        <Typography color="text.secondary">No customers found.</Typography>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Membership</TableCell>
                  <TableCell align="right">Upcoming</TableCell>
                  <TableCell>Last Booking</TableCell>
                  <TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/admin/customers/${c.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>
                      {c.name ?? <Typography component="span" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{c.email}</TableCell>
                    <TableCell>
                      {c.activeMembership ? (
                        <Chip
                          label={`${c.activeMembership}${c.membershipStatus === 'PAUSED' ? ' (paused)' : ''}`}
                          size="small"
                          color={c.membershipStatus === 'PAUSED' ? 'default' : 'success'}
                          variant={c.membershipStatus === 'PAUSED' ? 'outlined' : 'filled'}
                        />
                      ) : (
                        <Typography component="span" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{c.upcomingBookingCount}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {c.lastBookingAt
                        ? formatMountainTime(new Date(c.lastBookingAt), 'date')
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {formatMountainTime(new Date(c.createdAt), 'date')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Page {page} of {totalPages}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </Stack>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
