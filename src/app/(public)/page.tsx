import NextLink from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMountainTime } from '@/lib/timezone';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { md3 } from '@/lib/theme';

// "Header Large (serif)" from the design system doc — used for marketing
// section headers on this page only (see theme.ts for why h2 stays sans-bold).
const serifHeadingSx = {
  fontFamily: 'var(--font-gt-alpina), Georgia, serif',
  fontWeight: 400,
  fontSize: '2rem',
  lineHeight: 1.2,
} as const;

async function getUpcomingSessions() {
  return prisma.studioSession.findMany({
    where: { startsAt: { gte: new Date() }, isCancelled: false },
    include: {
      sessionType: { select: { name: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
    orderBy: { startsAt: 'asc' },
    take: 6,
  });
}

async function getActivePlans() {
  return prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
}

function formatPrice(cents: number, days: number) {
  const dollars = (cents / 100).toFixed(2);
  if (days <= 35) return `$${dollars}/mo`;
  if (days <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default async function HomePage() {
  const [sessions, plans] = await Promise.all([getUpcomingSessions(), getActivePlans()]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          bgcolor: md3.inverseSurface,
          color: md3.inverseOnSurface,
          py: { xs: 10, md: 14 },
          px: 3,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            variant="h1"
            sx={{ color: md3.inverseOnSurface }}
          >
            Learn to throw.
          </Typography>
          <Typography
            variant="body1"
            sx={{ mt: 3, color: `${md3.inverseOnSurface}CC`, fontSize: { xs: '1rem', md: '1.25rem' } }}
          >
            Pottery studio in Provo, Utah. Open studio sessions, classes, and memberships.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ justifyContent: 'center', gap: 1.5, mt: 4 }}
          >
            <Button
              component={NextLink}
              href="/schedule"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#FFFFFF',
                color: md3.inverseSurface,
                '&:hover': { bgcolor: md3.inversePrimary },
              }}
            >
              Browse Schedule
            </Button>
            <Button
              component={NextLink}
              href="/membership"
              variant="outlined"
              size="large"
              sx={{
                borderColor: `${md3.inverseOnSurface}50`,
                color: md3.inverseOnSurface,
                '&:hover': { bgcolor: `${md3.inverseOnSurface}15`, borderColor: md3.inverseOnSurface },
              }}
            >
              View Memberships
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── This Week ────────────────────────────────────────────────────────── */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 }, px: 3 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ mb: 4, ...serifHeadingSx }}>
            This Week
          </Typography>

          {sessions.length === 0 ? (
            <Typography color="text.secondary">
              No upcoming sessions this week. Check back soon!
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {sessions.map((s) => {
                const spots = s.capacity - s._count.bookings;
                const isFull = spots <= 0;
                return (
                  <Grid key={s.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                            {s.sessionType.name}
                          </Typography>
                          {isFull && (
                            <Chip label="Full" size="small" color="default" />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {formatMountainTime(s.startsAt, 'datetime')}
                        </Typography>
                        <Typography variant="body2" color={isFull ? 'error.main' : 'text.secondary'}>
                          {isFull ? 'No spots left' : `${spots} spot${spots !== 1 ? 's' : ''} remaining`}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button
                          component={NextLink}
                          href={`/schedule/${s.id}`}
                          variant={isFull ? 'outlined' : 'contained'}
                          size="small"
                          fullWidth
                        >
                          {isFull ? 'Join Waitlist' : 'Book'}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Link
              component={NextLink}
              href="/schedule"
              underline="always"
              sx={{ fontSize: '0.875rem', color: 'text.secondary' }}
            >
              See full schedule →
            </Link>
          </Box>
        </Container>
      </Box>

      {/* ── Become a Member ──────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          bgcolor: md3.surfaceVariant,
          py: { xs: 8, md: 10 },
          px: 3,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ mb: 1, ...serifHeadingSx }}>
            Become a Member
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Unlimited access, priority booking, and more.
          </Typography>

          {plans.length === 0 ? (
            <Typography color="text.secondary">Membership plans coming soon.</Typography>
          ) : (
            <Grid container spacing={2}>
              {plans.map((p) => (
                <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>{p.name}</Typography>
                      {p.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {p.description}
                        </Typography>
                      )}
                      <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                        {formatPrice(p.price, p.billingIntervalDays)}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        component={NextLink}
                        href="/membership"
                        variant="outlined"
                        size="small"
                        fullWidth
                      >
                        Learn More
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      {/* ── Visit Us ─────────────────────────────────────────────────────────── */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 }, px: 3 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ mb: 4, ...serifHeadingSx }}>
            Visit Us
          </Typography>
          <Grid container spacing={6}>
            {/* Text */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>Address</Typography>
                <Typography color="text.secondary">Provo, Utah</Typography>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Hours</Typography>
                <Stack spacing={0.5}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day) => (
                    <Box key={day} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="body2">{day}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        See schedule for session times
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2">Sunday</Typography>
                    <Typography variant="body2" color="text.secondary">Closed</Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>

            {/* Photo placeholder */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  minHeight: 192,
                  borderRadius: 3,
                  bgcolor: md3.surfaceVariant,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                }}
              >
                Photo coming soon
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
