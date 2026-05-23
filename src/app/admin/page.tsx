import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <Container maxWidth="lg" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      <Typography variant="h2" sx={{ fontWeight: 700 }}>
        Admin dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {session.user.name ?? session.user.email} &middot; {session.user.role}
      </Typography>
    </Container>
  );
}
