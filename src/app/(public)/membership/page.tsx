import type { ReactNode } from 'react';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CheckIcon from '@mui/icons-material/Check';

export const dynamic = 'force-dynamic';

function formatMonthly(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(0)}/mo`;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingIntervalDays: number;
  joiningFeeCents: number;
  commitmentMonths: number | null;
  retailDiscountPercent: number;
  shelfType: string | null;
  includesGuestPass: boolean;
  includesOnlineCourse: boolean;
  classTicketsPerPeriod: number | null;
  perks: unknown;
}

function shelfLabel(shelfType: string | null): string {
  if (shelfType === 'FULL') return 'Full shelf (48×24×12)';
  if (shelfType === 'HALF') return 'Half shelf (24×24×12)';
  return 'No shelf space';
}

function ticketsLabel(classTicketsPerPeriod: number | null): string {
  return classTicketsPerPeriod === null ? 'Unlimited' : `${classTicketsPerPeriod}/mo`;
}

export default async function MembershipPage() {
  const session = await auth();

  const plans: Plan[] = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  const basePlans = plans.filter((p) => p.commitmentMonths === null);
  const commitmentPlans = plans.filter((p) => p.commitmentMonths !== null);

  let activeMembership: { id: string } | null = null;
  if (session?.user?.id) {
    activeMembership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  const joinButton = (planId: string) =>
    activeMembership ? (
      <Button variant="contained" fullWidth disabled>
        You&apos;re a member
      </Button>
    ) : session?.user ? (
      <Button component={NextLink} href={`/membership/subscribe/${planId}`} variant="contained" fullWidth>
        Join
      </Button>
    ) : (
      <Button component={NextLink} href="/login?callbackUrl=/membership" variant="contained" fullWidth>
        Join
      </Button>
    );

  const comparisonRows: Array<{ label: string; values: (plan: Plan) => ReactNode }> = [
    { label: 'Price', values: (p) => <strong>{formatMonthly(p.price)}</strong> },
    { label: 'Shelf space', values: (p) => shelfLabel(p.shelfType) },
    { label: '24/6 studio access', values: () => <CheckIcon fontSize="small" color="success" /> },
    { label: 'Class tickets', values: (p) => ticketsLabel(p.classTicketsPerPeriod) },
    { label: 'Clay & firing discounts', values: () => <CheckIcon fontSize="small" color="success" /> },
    { label: 'Studio glazes', values: () => <CheckIcon fontSize="small" color="success" /> },
    { label: 'Workshops & member events', values: () => <CheckIcon fontSize="small" color="success" /> },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 }, px: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h1" sx={{ mb: 1.5 }}>
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
            <Button component={NextLink} href="/membership/manage" variant="outlined" size="small" color="success">
              Manage
            </Button>
          }
          icon={<Chip label="Active Member" size="small" color="success" sx={{ fontWeight: 600 }} />}
        >
          You already have an active membership.
        </Alert>
      )}

      {basePlans.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          No membership plans are currently available.
        </Typography>
      ) : (
        <>
          {/* Comparison table — md and up */}
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: 3, mb: 2, display: { xs: 'none', md: 'block' } }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  {basePlans.map((plan) => (
                    <TableCell key={plan.id} align="center" sx={{ fontWeight: 700 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{plan.name}</Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {comparisonRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{row.label}</TableCell>
                    {basePlans.map((plan) => (
                      <TableCell key={plan.id} align="center">{row.values(plan)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell />
                  {basePlans.map((plan) => (
                    <TableCell key={plan.id} align="center" sx={{ pb: 3 }}>
                      {joinButton(plan.id)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Stacked cards — below md */}
          <Grid container spacing={3} sx={{ mb: 2, display: { xs: 'flex', md: 'none' } }}>
            {basePlans.map((plan) => (
              <Grid key={plan.id} size={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>{plan.name}</Typography>
                    <Typography variant="h4" color="primary" sx={{ mb: 2, fontWeight: 700 }}>
                      {formatMonthly(plan.price)}
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {comparisonRows.map((row) => (
                        <Typography key={row.label} component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {row.label}: {row.values(plan)}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                  <CardActions>{joinButton(plan.id)}</CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {basePlans.some((p) => p.joiningFeeCents > 0) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 8 }}>
              * A one-time joining fee applies for first-time members and is waived on commitment
              memberships below.
            </Typography>
          )}
        </>
      )}

      {commitmentPlans.length > 0 && (
        <Box sx={{ mt: 8 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
              Bundle and Save
            </Typography>
            <Typography color="text.secondary">
              Commit to a term and unlock extra perks — plus your joining fee is waived.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {commitmentPlans.map((plan) => {
              const perks = Array.isArray(plan.perks) ? (plan.perks as string[]) : [];
              return (
                <Grid key={plan.id} size={{ xs: 12, sm: 6 }}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flex: 1 }}>
                      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>{plan.name}</Typography>
                      {plan.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {plan.description}
                        </Typography>
                      )}
                      <Typography variant="h4" color="primary" sx={{ mb: 1, fontWeight: 700 }}>
                        {formatMonthly(plan.price)}
                      </Typography>
                      <Chip
                        label={`${plan.commitmentMonths}-month commitment`}
                        size="small"
                        sx={{ mb: 2 }}
                      />
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {plan.retailDiscountPercent > 0 && (
                          <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                            {plan.retailDiscountPercent}% off retail
                          </Typography>
                        )}
                        {perks.map((perk) => (
                          <Typography key={perk} component="li" variant="body2" sx={{ mb: 0.5 }}>
                            {perk}
                          </Typography>
                        ))}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2 }}>{joinButton(plan.id)}</CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Container>
  );
}
