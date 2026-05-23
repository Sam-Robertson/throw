import NextLink from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';

export const dynamic = 'force-dynamic';

function formatPrice(priceInCents: number, billingIntervalDays: number): string {
  const dollars = (priceInCents / 100).toFixed(2);
  if (billingIntervalDays <= 35) return `$${dollars}/mo`;
  if (billingIntervalDays <= 100) return `$${dollars}/qtr`;
  return `$${dollars}/yr`;
}

export default async function MembershipPage() {
  const session = await auth();

  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  let activeMembership: { id: string } | null = null;
  if (session?.user?.id) {
    activeMembership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 }, px: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Membership Plans
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Join our studio community with a recurring membership.
        </Typography>
      </Box>

      {activeMembership && (
        <Alert
          severity="success"
          sx={{ mb: 4, alignItems: 'center' }}
          action={
            <Button
              component={NextLink}
              href="/membership/manage"
              variant="outlined"
              size="small"
              color="success"
            >
              Manage
            </Button>
          }
          icon={<Chip label="Active Member" size="small" color="success" sx={{ fontWeight: 600 }} />}
        >
          You already have an active membership.
        </Alert>
      )}

      <Grid container spacing={3}>
        {plans.map((plan) => (
          <Grid key={plan.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>
                  {plan.name}
                </Typography>
                {plan.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {plan.description}
                  </Typography>
                )}
                <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
                  {formatPrice(plan.price, plan.billingIntervalDays)}
                </Typography>
              </CardContent>
              <CardActions>
                {activeMembership ? (
                  <Button variant="contained" fullWidth disabled>
                    You&apos;re a member
                  </Button>
                ) : session?.user ? (
                  <Button
                    component={NextLink}
                    href={`/membership/subscribe/${plan.id}`}
                    variant="contained"
                    fullWidth
                  >
                    Join
                  </Button>
                ) : (
                  <Button
                    component={NextLink}
                    href={`/login?callbackUrl=/membership`}
                    variant="contained"
                    fullWidth
                  >
                    Join
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
        {plans.length === 0 && (
          <Grid size={12}>
            <Typography
              color="text.secondary"
              sx={{ textAlign: 'center', py: 8 }}
            >
              No membership plans are currently available.
            </Typography>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
