import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import NextLink from 'next/link';
import { prisma } from '@/lib/prisma';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import LinearProgress from '@mui/material/LinearProgress';
import { formatMountainTime } from '@/lib/timezone';
import { getTicketBalance } from '@/lib/credits';
import { SignOutButton } from './_components/SignOutButton';
import { CancelBookingButton } from './_components/CancelBookingButton';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  CONFIRMED: 'success',
  WAITLIST: 'warning',
  CANCELLED: 'error',
  NO_SHOW: 'default',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [membership, activeWaiver, upcomingCount, upcomingBookings] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } },
      include: { plan: { select: { name: true, classTicketsPerPeriod: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.waiverVersion.findFirst({
      where: { isActive: true },
      include: { signatures: { where: { userId } } },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
        studioSession: { startsAt: { gte: now } },
      },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
        studioSession: { startsAt: { gte: now } },
      },
      include: {
        studioSession: {
          include: {
            sessionType: { select: { name: true } },
            location: { select: { name: true } },
          },
        },
      },
      orderBy: { studioSession: { startsAt: 'asc' } },
      take: 5,
    }),
  ]);

  const waiverSigned = !activeWaiver || activeWaiver.signatures.length > 0;

  const ticketBalance = membership ? await getTicketBalance(membership.id) : null;

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Welcome, {session.user.name ?? session.user.email}
        </Typography>
        <SignOutButton />
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {/* Membership */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              Membership
            </Typography>
            {membership ? (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {membership.plan.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {membership.status === 'PAUSED'
                    ? 'Paused'
                    : `Renews ${formatMountainTime(membership.currentPeriodEnd, 'date')}`}
                </Typography>
                {ticketBalance && (
                  <Box sx={{ mt: 1.5 }}>
                    {ticketBalance.unlimited ? (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Unlimited classes
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {Math.max(0, (ticketBalance.balance ?? 0))} of {ticketBalance.allowance} class
                          tickets remaining
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={
                            ticketBalance.allowance > 0
                              ? Math.min(100, (Math.max(0, ticketBalance.balance ?? 0) / ticketBalance.allowance) * 100)
                              : 0
                          }
                          sx={{ mt: 0.75, mb: 0.75, height: 6, borderRadius: 3 }}
                        />
                      </>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Resets {formatMountainTime(membership.currentPeriodEnd, 'date')}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  No active membership
                </Typography>
                <Link component={NextLink} href="/membership" underline="always" variant="body2" sx={{ display: 'block', mt: 0.5 }}>
                  Browse Plans
                </Link>
              </>
            )}
          </Paper>
        </Grid>

        {/* Upcoming bookings */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              Upcoming Bookings
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700 }}>
              {upcomingCount}
            </Typography>
          </Paper>
        </Grid>

        {/* Waiver */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              Waiver
            </Typography>
            {waiverSigned ? (
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                Signed ✓
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  Signature required
                </Typography>
                <Link component={NextLink} href="/waiver" underline="always" variant="body2" sx={{ display: 'block', mt: 0.5 }}>
                  Sign now
                </Link>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Upcoming sessions */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Upcoming Sessions
        </Typography>
        {upcomingBookings.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No upcoming sessions.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            {upcomingBookings.map((b, idx) => {
              const canCancel = b.studioSession.startsAt > twoHoursFromNow;
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
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {b.studioSession.sessionType.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatMountainTime(b.studioSession.startsAt, 'datetime')}
                        {b.studioSession.location && ` · ${b.studioSession.location.name}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Chip
                        label={b.status}
                        size="small"
                        color={STATUS_COLOR[b.status] ?? 'default'}
                      />
                      {canCancel && <CancelBookingButton bookingId={b.id} />}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Paper>
        )}
      </Box>

      {/* Quick links */}
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Quick Links
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {[
            { href: '/schedule', label: 'Browse Schedule' },
            { href: '/bookings', label: 'My Bookings' },
            { href: '/membership/manage', label: 'Manage Membership' },
            { href: '/account', label: 'Account Settings' },
          ].map((l) => (
            <Button
              key={l.href}
              component={NextLink}
              href={l.href}
              variant="outlined"
              size="small"
            >
              {l.label}
            </Button>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
