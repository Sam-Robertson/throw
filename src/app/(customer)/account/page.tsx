import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import NextLink from 'next/link';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import { ProfileForm } from './_components/ProfileForm';
import { PasswordForm } from './_components/PasswordForm';
import { DangerZone } from './_components/DangerZone';

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  });

  if (!user) redirect('/login');

  return (
    <Container maxWidth="sm" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Link
          component={NextLink}
          href="/dashboard"
          underline="always"
          variant="body2"
          color="text.secondary"
        >
          ← Dashboard
        </Link>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Account Settings
        </Typography>
      </Box>

      <Box component="section" sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          Profile
        </Typography>
        <ProfileForm user={user} />
      </Box>

      <Divider sx={{ mb: 5 }} />

      <Box component="section" sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          Change Password
        </Typography>
        <PasswordForm />
      </Box>

      <Divider sx={{ mb: 5 }} />

      <Box component="section">
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'error.main' }}>
          Danger Zone
        </Typography>
        <DangerZone />
      </Box>
    </Container>
  );
}
