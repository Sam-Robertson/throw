import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { getApplicableWaivers } from "@/lib/waivers";
import { checkPermission } from "@/lib/permissions";
import { resolveLocationScope, scopeAllows } from "@/lib/locationScope";
import { formatMountainTime } from "@/lib/timezone";
import { RosterClient, type RosterRow } from "./_components/RosterClient";

export default async function StaffSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const studioSession = await prisma.studioSession.findUnique({
    where: { id },
    include: {
      sessionType: { select: { id: true, name: true, kind: true } },
      instructor: { select: { name: true, email: true } },
      bookings: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!studioSession) notFound();

  // STAFF may only open rosters for their own studios.
  if (!scopeAllows(resolveLocationScope(session), studioSession.locationId)) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="body1" color="text.secondary">
          This session is at a studio you&apos;re not assigned to. Ask an admin if you need
          access.
        </Typography>
      </Container>
    );
  }

  // Check the permission at this session's studio, not "any studio".
  const allowed = await checkPermission(
    session.user.id,
    "canCheckInMembers",
    studioSession.locationId ?? undefined,
  );
  if (!allowed) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="body1" color="text.secondary">
          You don&apos;t have permission to check in members. Ask an admin if you think this is a
          mistake.
        </Typography>
      </Container>
    );
  }

  // Every class waiver this session requires at its studio (its own, plus any
  // all-studio one, or the fallback when it has none), for this class type.
  const requiredWaivers = await getApplicableWaivers(studioSession.locationId, "CLASS", {
    sessionTypeId: studioSession.sessionType.id,
    sessionKind: studioSession.sessionType.kind,
  });
  const requiredVersionIds = requiredWaivers.map((w) => w.id);

  const relevantBookings = studioSession.bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "NO_SHOW",
  );
  const waitlistBookings = studioSession.bookings.filter((b) => b.status === "WAITLIST");

  const userIds = [...new Set(studioSession.bookings.map((b) => b.userId))];
  const signatures = requiredVersionIds.length
    ? await prisma.waiverSignature.findMany({
        where: { waiverVersionId: { in: requiredVersionIds }, userId: { in: userIds } },
        select: { userId: true, waiverVersionId: true },
      })
    : [];
  // Signed means signed every required waiver, not just one of them.
  const signedCount = new Map<string, number>();
  for (const s of signatures) signedCount.set(s.userId, (signedCount.get(s.userId) ?? 0) + 1);
  const signedUserIds = new Set(
    [...signedCount].filter(([, n]) => n >= requiredVersionIds.length).map(([id]) => id),
  );

  const roster: RosterRow[] = relevantBookings.map((b) => ({
    bookingId: b.id,
    customerName: b.user.name ?? b.user.email,
    status: b.status as "CONFIRMED" | "NO_SHOW",
    source: b.source,
    waiverSigned: requiredVersionIds.length === 0 || signedUserIds.has(b.userId),
  }));

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      <Link
        component={NextLink}
        href="/staff"
        underline="always"
        variant="body2"
        sx={{ display: "inline-block", mb: 3 }}
      >
        &larr; Back to dashboard
      </Link>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          {studioSession.title ?? studioSession.sessionType.name}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {formatMountainTime(studioSession.startsAt, "datetime")}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap" }}>
          <Chip
            label={`Instructor: ${studioSession.instructor?.name ?? studioSession.instructor?.email ?? "Unassigned"}`}
            size="small"
            variant="outlined"
          />
          <Chip label={`Capacity: ${studioSession.capacity}`} size="small" variant="outlined" />
        </Stack>
      </Box>

      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Roster
        </Typography>
        <RosterClient initialRoster={roster} />
      </Box>

      {waitlistBookings.length > 0 && (
        <Box>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            Waitlist
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            {waitlistBookings.map((b, idx) => (
              <Box key={b.id}>
                {idx > 0 && <Divider />}
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <Typography variant="body2">{b.user.name ?? b.user.email}</Typography>
                </Box>
              </Box>
            ))}
          </Paper>
        </Box>
      )}
    </Container>
  );
}
