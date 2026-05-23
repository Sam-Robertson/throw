'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { formatMountainTime } from '@/lib/timezone';

type TabValue = 'upcoming' | 'past' | 'cancelled';
type BookingStatus = 'CONFIRMED' | 'WAITLIST' | 'CANCELLED' | 'NO_SHOW';
type BookingSource = 'MEMBERSHIP_CREDIT' | 'MEMBER_FREE' | 'DROP_IN' | 'COMP';

interface Booking {
  id: string;
  status: BookingStatus;
  source: BookingSource;
  amountPaidCents: number;
  hasTip: boolean;
  studioSession: {
    startsAt: string;
    endsAt: string;
    sessionType: { name: string };
    location: { name: string } | null;
    instructor: { id: string; name: string | null } | null;
  };
}

const STATUS_COLOR: Record<BookingStatus, 'success' | 'warning' | 'error' | 'default'> = {
  CONFIRMED: 'success',
  WAITLIST: 'warning',
  CANCELLED: 'error',
  NO_SHOW: 'default',
};

const SOURCE_LABEL: Record<BookingSource, string> = {
  MEMBERSHIP_CREDIT: 'Member',
  MEMBER_FREE: 'Member',
  DROP_IN: 'Drop-in',
  COMP: 'Comp',
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function BookingsInner() {
  const searchParams = useSearchParams();
  const justTipped = searchParams.get('tipped') === '1';

  const [tab, setTab] = useState<TabValue>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const limit = 20;

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: tab, page: String(page), limit: String(limit) });
    const res = await fetch(`/api/bookings?${params}`);
    if (res.ok) {
      const data = await res.json() as { bookings: Booking[]; total: number };
      setBookings(data.bookings);
      setTotal(data.total);
    }
    setLoading(false);
  }, [tab, page]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  function handleTabChange(_: React.SyntheticEvent, value: TabValue) {
    setTab(value);
    setPage(1);
  }

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json().catch(() => ({})) as { error?: string; refundNote?: string };
    if (res.ok) {
      if (data.refundNote) alert(data.refundNote);
      await loadBookings();
    } else {
      alert(data.error ?? 'Could not cancel booking');
    }
    setCancellingId(null);
  }

  const totalPages = Math.ceil(total / limit);
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      {justTipped && (
        <Alert severity="success" sx={{ mb: 3 }}>
          💚 Your tip was sent — thank you for supporting your instructor!
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Link component={NextLink} href="/dashboard" underline="always" variant="body2" color="text.secondary">
          ← Dashboard
        </Link>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>My Bookings</Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Upcoming" value="upcoming" />
        <Tab label="Past" value="past" />
        <Tab label="Cancelled" value="cancelled" />
      </Tabs>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : bookings.length === 0 ? (
        <Typography color="text.secondary">No bookings found.</Typography>
      ) : (
        <>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            {bookings.map((b, idx) => {
              const startsAt = new Date(b.studioSession.startsAt);
              const canCancel = tab === 'upcoming' && startsAt > twoHoursFromNow;

              return (
                <Box key={b.id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      px: 2.5,
                      py: 1.75,
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.studioSession.sessionType.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatMountainTime(startsAt, 'datetime')}
                        {b.studioSession.location && ` · ${b.studioSession.location.name}`}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                      <Chip label={SOURCE_LABEL[b.source]} size="small" variant="outlined" />
                      {b.source === 'DROP_IN' && b.amountPaidCents > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {formatCents(b.amountPaidCents)}
                        </Typography>
                      )}
                      <Chip
                        label={b.status}
                        size="small"
                        color={STATUS_COLOR[b.status]}
                      />
                      {tab === 'past' && (() => {
                        const endsAt = new Date(b.studioSession.endsAt);
                        const hasInstructor = !!b.studioSession.instructor;
                        if (!hasInstructor || endsAt >= now) return null;
                        if (b.hasTip) {
                          return (
                            <Chip
                              label="Tip sent ✓"
                              size="small"
                              variant="outlined"
                              sx={{ color: 'success.main', borderColor: 'success.light' }}
                            />
                          );
                        }
                        return (
                          <Button
                            component={NextLink}
                            href={`/bookings/${b.id}/tip`}
                            size="small"
                            variant="text"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Leave a tip
                          </Button>
                        );
                      })()}
                      {canCancel && (
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Paper>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {total} booking{total !== 1 ? 's' : ''}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button variant="outlined" size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {page} / {totalPages}
                </Typography>
                <Button variant="outlined" size="small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </Stack>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
          <Typography color="text.secondary">Loading…</Typography>
        </Container>
      }
    >
      <BookingsInner />
    </Suspense>
  );
}
