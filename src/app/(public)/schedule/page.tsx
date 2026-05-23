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
import Stack from '@mui/material/Stack';
import { md3 } from '@/lib/theme';

async function getSessionTypes() {
  return prisma.sessionType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}

async function getSessions(typeSlug?: string) {
  return prisma.studioSession.findMany({
    where: {
      startsAt: { gte: new Date() },
      isCancelled: false,
      ...(typeSlug ? { sessionType: { slug: typeSlug } } : {}),
    },
    include: {
      sessionType: {
        select: { name: true, slug: true, durationMinutes: true, dropInPriceCents: true },
      },
      instructor: { select: { name: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
    orderBy: { startsAt: 'asc' },
  });
}

type Session = Awaited<ReturnType<typeof getSessions>>[number];

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = formatMountainTime(s.startsAt, 'date');
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return groups;
}

function SessionCard({ session }: { session: Session }) {
  const spotsRemaining = session.capacity - session._count.bookings;
  const isFull = spotsRemaining <= 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 2 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
            {session.sessionType.name}
          </Typography>
          {isFull && <Chip label="Full" size="small" />}
        </Box>

        <Stack spacing={0.5}>
          {[
            { label: 'Time', value: formatMountainTime(session.startsAt, 'time') },
            { label: 'Duration', value: `${session.sessionType.durationMinutes} min` },
            ...(session.instructor?.name ? [{ label: 'Instructor', value: session.instructor.name }] : []),
            {
              label: 'Spots left',
              value: isFull ? '0' : String(spotsRemaining),
              error: isFull,
            },
            { label: 'Drop-in', value: formatPrice(session.sessionType.dropInPriceCents) },
          ].map(({ label, value, error }) => (
            <Box key={label} sx={{ display: 'flex', gap: 1.5 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ width: 84, flexShrink: 0 }}
              >
                {label}
              </Typography>
              <Typography
                variant="body2"
                color={error ? 'error.main' : 'text.primary'}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
      <CardActions>
        <Button
          component={NextLink}
          href={`/schedule/${session.id}`}
          variant={isFull ? 'outlined' : 'contained'}
          size="small"
          fullWidth
        >
          {isFull ? 'Join Waitlist' : 'Book'}
        </Button>
      </CardActions>
    </Card>
  );
}

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function SchedulePage({ searchParams }: Props) {
  const { type: typeSlug } = await searchParams;
  const [sessionTypes, sessions] = await Promise.all([getSessionTypes(), getSessions(typeSlug)]);
  const grouped = groupByDate(sessions);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 }, px: { xs: 3, md: 4 } }}>
      <Typography variant="h1" sx={{ mb: 4, fontWeight: 700 }}>
        Schedule
      </Typography>

      {/* Filter pills */}
      {sessionTypes.length > 0 && (
        <Box sx={{ mb: 5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            component={NextLink}
            href="/schedule"
            label="All"
            clickable
            variant={!typeSlug ? 'filled' : 'outlined'}
            color={!typeSlug ? 'primary' : 'default'}
          />
          {sessionTypes.map((t) => (
            <Chip
              key={t.id}
              component={NextLink}
              href={`/schedule?type=${t.slug}`}
              label={t.name}
              clickable
              variant={typeSlug === t.slug ? 'filled' : 'outlined'}
              color={typeSlug === t.slug ? 'primary' : 'default'}
            />
          ))}
        </Box>
      )}

      {grouped.size === 0 ? (
        <Typography color="text.secondary">
          No upcoming sessions scheduled. Check back soon.
        </Typography>
      ) : (
        <Stack spacing={6}>
          {Array.from(grouped.entries()).map(([date, daySessions]) => (
            <Box component="section" key={date}>
              <Typography
                variant="h5"
                sx={{
                  mb: 2,
                  pb: 1,
                  borderBottom: `2px solid ${md3.outlineVariant}`,
                }}
              >
                {date}
              </Typography>
              <Grid container spacing={2}>
                {daySessions.map((s) => (
                  <Grid key={s.id} size={{ xs: 12, sm: 6 }}>
                    <SessionCard session={s} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  );
}
