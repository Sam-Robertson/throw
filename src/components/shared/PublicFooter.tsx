import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CircleIcon from '@mui/icons-material/Circle';
import { md3 } from '@/lib/theme';

const FOOTER_LINKS = [
  { href: '/schedule', label: 'Schedule' },
  { href: '/membership', label: 'Memberships' },
  { href: '/about', label: 'About' },
  { href: '/login', label: 'Login' },
];

export function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: md3.inverseSurface,
        color: md3.inverseOnSurface,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 }, px: { xs: 3, md: 4 } }}>
        <Grid container spacing={4}>
          {/* Wordmark + tagline */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: md3.inverseOnSurface }}
            >
              Throw
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: `${md3.inverseOnSurface}99` }}
            >
              Pottery studio in Provo, Utah
            </Typography>
          </Grid>

          {/* Links */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {FOOTER_LINKS.map((l) => (
                <Link
                  key={l.href}
                  component={NextLink}
                  href={l.href}
                  underline="hover"
                  sx={{
                    color: `${md3.inverseOnSurface}99`,
                    fontSize: '0.875rem',
                    '&:hover': { color: md3.inverseOnSurface },
                    transition: 'color 0.2s',
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </Box>
          </Grid>

          {/* Social */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <IconButton
              href="#"
              aria-label="Instagram (coming soon)"
              title="Instagram — coming soon"
              sx={{ color: `${md3.inverseOnSurface}60`, p: 0.5 }}
            >
              <CircleIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: `${md3.inverseOnSurface}20` }} />

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: `${md3.inverseOnSurface}60`,
          }}
        >
          © 2025 Throw Art Studio. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
