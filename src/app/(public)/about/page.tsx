import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { md3 } from '@/lib/theme';

export const metadata = { title: 'About — Throw' };

const OFFERINGS = [
  {
    title: 'Open Studio',
    desc: 'Drop in and work on your own projects during scheduled open studio sessions.',
  },
  {
    title: 'Classes & Workshops',
    desc: 'Wheel throwing and hand building classes for all skill levels.',
  },
  {
    title: 'Memberships',
    desc: 'Recurring memberships with unlimited studio access and priority booking.',
  },
  {
    title: 'Private Events',
    desc: 'Private studio rentals and group events — coming soon.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <Box
        component="section"
        sx={{ bgcolor: md3.inverseSurface, color: md3.inverseOnSurface, py: { xs: 8, md: 12 }, px: 3 }}
      >
        <Container maxWidth="md">
          <Typography variant="h1" sx={{ color: md3.inverseOnSurface }}>
            About Throw
          </Typography>
          <Typography
            variant="body1"
            sx={{ mt: 2.5, color: `${md3.inverseOnSurface}B3`, fontSize: { xs: '1rem', md: '1.125rem' } }}
          >
            Throw is a pottery studio in Provo, Utah offering open studio sessions, wheel throwing
            classes, hand building workshops, and memberships.
          </Typography>
        </Container>
      </Box>

      {/* What We Offer */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 }, px: 3 }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ mb: 4, fontWeight: 700 }}>
            What We Offer
          </Typography>
          <Stack spacing={3}>
            {OFFERINGS.map((item) => (
              <Box key={item.title} sx={{ display: 'flex', gap: 2 }}>
                <CheckCircleOutlineIcon
                  sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}
                />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Find Us */}
      <Box
        component="section"
        sx={{ bgcolor: md3.surfaceVariant, py: { xs: 8, md: 10 }, px: 3 }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ mb: 4, fontWeight: 700 }}>
            Find Us
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Address
            </Typography>
            <Typography color="text.secondary">Provo, Utah</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Hours
            </Typography>
            <Stack spacing={0.5}>
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day) => (
                <Box key={day} sx={{ display: 'flex', gap: 4 }}>
                  <Typography variant="body2" sx={{ width: 100, flexShrink: 0 }}>
                    {day}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    See schedule for session times
                  </Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Typography variant="body2" sx={{ width: 100, flexShrink: 0 }}>
                  Sunday
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Closed
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 }, px: 3, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography variant="h2" sx={{ mb: 2, fontWeight: 700 }}>
            Ready to get your hands dirty?
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Browse our upcoming sessions and book your spot today.
          </Typography>
          <Button component={NextLink} href="/schedule" variant="contained" size="large">
            See the Schedule
          </Button>
        </Container>
      </Box>
    </>
  );
}
