import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export const metadata = { title: 'Unsubscribed — Throw' };

export default function UnsubscribedPage() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, md: 10 }, px: 3, textAlign: 'center' }}>
      <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
        You&apos;ve been unsubscribed
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        You&apos;ve been unsubscribed from marketing emails.
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        We&apos;ll still send transactional messages about your bookings and payments —
        those aren&apos;t marketing.
      </Typography>
      <Box>
        <Button component={NextLink} href="/account" variant="contained">
          Resubscribe
        </Button>
      </Box>
    </Container>
  );
}
