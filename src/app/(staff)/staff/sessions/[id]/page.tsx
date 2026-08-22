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
import { checkPermission } from "@/lib/permissions";
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

  const allowed = await checkPermission(session.user.id, "canCheckInMembers");
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

  const studioSession = await prisma.studioSession.findUnique({
    where: { id },
    include: {
      sessionType: { select: { name: true } },
      instructor: { select: { name: true, email: true } },
      bookings: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!studioSession) notFound();

  const activeWaiver = await prisma.waiverVersion.findFirst({
    where: { isActive: true },
  });

  const relevantBookings = studioSession.bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "NO_SHOW",
  );
  const waitlistBookings = studioSession.bookings.filter((b) => b.status === "WAITLIST");

  const userIds = [...new Set(studioSession.bookings.map((b) => b.userId))];
  const signatures = activeWaiver
    ? await prisma.waiverSignature.findMany({
        where: { waiverVersionId: activeWaiver.id, userId: { in: userIds } },
        select: { userId: true },
      })
    : [];
  const signedUserIds = new Set(signatures.map((s) => s.userId));

  const roster: RosterRow[] = relevantBookings.map((b) => ({
    bookingId: b.id,
    customerName: b.user.name ?? b.user.email,
    status: b.status as "CONFIRMED" | "NO_SHOW",
    source: b.source,
    waiverSigned: !activeWaiver || signedUserIds.has(b.userId),
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
          {studioSession.sessionType.name}
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
