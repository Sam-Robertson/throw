import NextLink from 'next/link';
import Image from 'next/image';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import { md3 } from '@/lib/theme';

const FOOTER_COLUMNS = [
  {
    heading: 'Learn to throw',
    links: [
      { href: '/schedule', label: 'Schedule' },
      { href: '/membership', label: 'Memberships' },
      { href: '/community', label: 'Community' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { href: 'mailto:hello@throwstudio.com', label: 'hello@throwstudio.com' },
      { href: '/login', label: 'My Account' },
    ],
  },
  {
    heading: 'About us',
    links: [{ href: '/about', label: 'About' }],
  },
  {
    heading: 'Other',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

const linkSx = {
  color: `${md3.inverseOnSurface}99`,
  fontSize: '0.875rem',
  '&:hover': { color: md3.inverseOnSurface },
  transition: 'color 0.2s',
};

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
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image src="/mascot.png" alt="" width={217} height={217} style={{ height: 28, width: 'auto' }} />
            <Typography
              sx={{
                fontFamily: 'var(--font-gt-alpina), Georgia, serif',
                fontSize: '1.5rem',
                fontWeight: 400,
                color: md3.inverseOnSurface,
              }}
            >
              Throw
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5, color: `${md3.inverseOnSurface}99` }}>
            Pottery studio in Provo, Utah
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {FOOTER_COLUMNS.map((col) => (
            <Grid key={col.heading} size={{ xs: 6, sm: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{ color: md3.inverseOnSurface, mb: 1.5, fontWeight: 700 }}
              >
                {col.heading}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {col.links.map((l) => (
                  <Link key={l.href} component={NextLink} href={l.href} underline="hover" sx={linkSx}>
                    {l.label}
                  </Link>
                ))}
              </Box>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4, borderColor: `${md3.inverseOnSurface}20` }} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: `${md3.inverseOnSurface}60` }}>
            © 2026 Throw Art Studio. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              href="#"
              aria-label="Instagram (coming soon)"
              title="Instagram — coming soon"
              sx={{ color: `${md3.inverseOnSurface}60`, p: 0.5 }}
            >
              <InstagramIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              href="#"
              aria-label="Facebook (coming soon)"
              title="Facebook — coming soon"
              sx={{ color: `${md3.inverseOnSurface}60`, p: 0.5 }}
            >
              <FacebookIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
