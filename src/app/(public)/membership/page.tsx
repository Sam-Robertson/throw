import type { ReactNode } from 'react';
import NextLink from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { shortLocationName } from '@/lib/locationName';
import { billingPeriodLabel } from '@/lib/billingInterval';
import {
  PURCHASABLE_PLAN_WHERE,
  getCapGroupUsage,
  type CapGroupUsage,
} from '@/lib/membershipCatalog';
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

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatPrice(priceInCents: number, billingIntervalDays: number): string {
  return `${formatDollars(priceInCents)} / ${billingPeriodLabel(billingIntervalDays)}`;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingIntervalDays: number;
  joiningFeeCents: number;
  shelfType: string | null;
  classTicketsPerPeriod: number | null;
  perks: unknown;
  isFounding: boolean;
  capGroupId: string | null;
  forfeitsRateOnCancelOrFreeze: boolean;
  location: { id: string; name: string; address: string | null } | null;
}

function shelfLabel(shelfType: string | null): string {
  if (shelfType === 'FULL') return 'Full shelf (48×24×12)';
  if (shelfType === 'HALF') return 'Half shelf (24×24×12)';
  return 'No shelf space';
}

function ticketsLabel(plan: Plan): string {
  return plan.classTicketsPerPeriod === null
    ? 'Unlimited'
    : `${plan.classTicketsPerPeriod} / ${billingPeriodLabel(plan.billingIntervalDays)}`;
}

function perksOf(plan: Plan): string[] {
  return Array.isArray(plan.perks) ? (plan.perks as string[]) : [];
}

export default async function MembershipPage() {
  const session = await auth();

  // Only plans that can be bought online: active, public, not legacy, not archived.
  const allPlans: Plan[] = await prisma.membershipPlan.findMany({
    where: PURCHASABLE_PLAN_WHERE,
    orderBy: { price: 'asc' },
    include: { location: { select: { id: true, name: true, address: true } } },
  });

  // A capped plan (Lehi founding rates) disappears once its cap group is full.
  const capUsage = await getCapGroupUsage(allPlans.flatMap((p) => (p.capGroupId ? [p.capGroupId] : [])));
  const usageOf = (plan: Plan): CapGroupUsage | null =>
    plan.capGroupId ? (capUsage.get(plan.capGroupId) ?? null) : null;
  const plans = allPlans.filter((p) => (usageOf(p)?.remaining ?? 1) > 0);

  const terms = await prisma.commitmentTerm.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const commitmentTerms = terms.filter((t) => t.months !== null);
  const monthToMonth = terms.find((t) => t.months === null) ?? null;
  // With terms set up the joining fee comes from the term; otherwise from the plans.
  const joiningFeeCents = monthToMonth
    ? monthToMonth.joiningFeeCents
    : Math.max(0, ...plans.map((p) => p.joiningFeeCents));

  // One section per studio, in the order the studios were opened.
  const studios = await prisma.location.findMany({
    where: { isActive: true, id: { in: plans.flatMap((p) => (p.location ? [p.location.id] : [])) } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, address: true },
  });
  const sections = [
    ...studios.map((studio) => ({
      key: studio.id,
      title: shortLocationName(studio.name, studio.address),
      plans: plans.filter((p) => p.location?.id === studio.id),
    })),
    { key: 'none', title: null, plans: plans.filter((p) => p.location === null) },
  ].filter((section) => section.plans.length > 0);

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

  // Perk rows come from the plans' own perk lists, so the table never claims
  // something a plan doesn't have.
  const comparisonRows = (sectionPlans: Plan[]): Array<{ label: string; values: (plan: Plan) => ReactNode }> => [
    { label: 'Price', values: (p) => <strong>{formatPrice(p.price, p.billingIntervalDays)}</strong> },
    { label: 'Shelf space', values: (p) => shelfLabel(p.shelfType) },
    { label: 'Class tickets', values: (p) => ticketsLabel(p) },
    ...[...new Set(sectionPlans.flatMap(perksOf))].map((perk) => ({
      label: perk,
      values: (p: Plan) =>
        perksOf(p).includes(perk) ? <CheckIcon fontSize="small" color="success" /> : '—',
    })),
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

      {sections.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          No membership plans are currently available.
        </Typography>
      )}

      {sections.map((section) => {
        const standardPlans = section.plans.filter((p) => !p.isFounding);
        const foundingPlans = section.plans.filter((p) => p.isFounding);
        const rows = comparisonRows(standardPlans);
        return (
          <Box key={section.key} sx={{ mb: 8 }}>
            {section.title && sections.length > 1 && (
              <Typography variant="h2" sx={{ fontWeight: 700, mb: 3 }}>
                {section.title}
              </Typography>
            )}

            {foundingPlans.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                  Founding member rates
                </Typography>
                <Grid container spacing={3}>
                  {foundingPlans.map((plan) => {
                    const usage = usageOf(plan);
                    return (
                      <Grid key={plan.id} size={{ xs: 12, md: 4 }}>
                        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <CardContent sx={{ flex: 1 }}>
                            <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>{plan.name}</Typography>
                            <Typography variant="h4" color="primary" sx={{ mb: 1, fontWeight: 700 }}>
                              {formatPrice(plan.price, plan.billingIntervalDays)}
                            </Typography>
                            {usage && (
                              <Chip
                                label={`${usage.remaining} of ${usage.cap} left`}
                                size="small"
                                color="warning"
                                sx={{ mb: 2, fontWeight: 600 }}
                              />
                            )}
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {shelfLabel(plan.shelfType)}
                              </Typography>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                Class tickets: {ticketsLabel(plan)}
                              </Typography>
                              {perksOf(plan).map((perk) => (
                                <Typography key={perk} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                  {perk}
                                </Typography>
                              ))}
                            </Box>
                            {plan.forfeitsRateOnCancelOrFreeze && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                                The founding rate is lost if you cancel or freeze.
                              </Typography>
                            )}
                          </CardContent>
                          <CardActions sx={{ p: 2 }}>{joinButton(plan.id)}</CardActions>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {standardPlans.length > 0 && (
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
                        {standardPlans.map((plan) => (
                          <TableCell key={plan.id} align="center" sx={{ fontWeight: 700 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{plan.name}</Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{row.label}</TableCell>
                          {standardPlans.map((plan) => (
                            <TableCell key={plan.id} align="center">{row.values(plan)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell />
                        {standardPlans.map((plan) => (
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
                  {standardPlans.map((plan) => (
                    <Grid key={plan.id} size={12}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>{plan.name}</Typography>
                          <Typography variant="h4" color="primary" sx={{ mb: 2, fontWeight: 700 }}>
                            {formatPrice(plan.price, plan.billingIntervalDays)}
                          </Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            {rows.slice(1).map((row) => (
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
              </>
            )}
          </Box>
        );
      })}

      {sections.length > 0 && joiningFeeCents > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 8 }}>
          * A one-time {formatDollars(joiningFeeCents)} joining fee applies for first-time members
          {commitmentTerms.some((t) => t.joiningFeeCents === 0)
            ? ' and is waived when you commit to a term below.'
            : '.'}
        </Typography>
      )}

      {sections.length > 0 && commitmentTerms.length > 0 && (
        <Box sx={{ mt: 8 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
              Bundle and Save
            </Typography>
            <Typography color="text.secondary">
              Commit to a term on any plan and unlock extra perks. You choose your term when you join.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {commitmentTerms.map((term) => (
              <Grid key={term.id} size={{ xs: 12, sm: 6 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>{term.name}</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {term.joiningFeeCents === 0 && joiningFeeCents > 0 && (
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          Joining fee waived
                        </Typography>
                      )}
                      {term.retailDiscountPercent > 0 && (
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {term.retailDiscountPercent}% off retail
                        </Typography>
                      )}
                      {term.includesGuestPass && (
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          Guest pass included
                        </Typography>
                      )}
                      {term.includesVideoLibrary && (
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          Video library
                        </Typography>
                      )}
                      {term.freeMonths > 0 && (
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {term.freeMonths} month{term.freeMonths === 1 ? '' : 's'} free
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Container>
  );
}
