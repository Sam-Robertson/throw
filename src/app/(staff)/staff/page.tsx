import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { formatMountainTime, STUDIO_TIMEZONE } from "@/lib/timezone";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { TasksCard, type TaskRow } from "./_components/TasksCard";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function StaffPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/staff");

  const userId = session.user.id;
  const nowMT = toZonedTime(new Date(), STUDIO_TIMEZONE);
  const firstName = session.user.name?.trim().split(/\s+/)[0] || session.user.email?.split("@")[0] || "there";

  const [assignment, canCheckInMembers, canManageTasks, canViewTips, canManageSchedule] =
    await Promise.all([
      prisma.staffRoleAssignment.findFirst({
        where: { userId },
        include: { staffRole: { include: { location: true } } },
      }),
      checkPermission(userId, "canCheckInMembers"),
      checkPermission(userId, "canManageTasks"),
      checkPermission(userId, "canViewTips"),
      checkPermission(userId, "canManageSchedule"),
    ]);

  // Today's sessions — start/end of today in Mountain Time.
  const todayStart = fromZonedTime(startOfDay(nowMT), STUDIO_TIMEZONE);
  const todayEnd = fromZonedTime(endOfDay(nowMT), STUDIO_TIMEZONE);

  const todaySessions = await prisma.studioSession.findMany({
    where: { startsAt: { gte: todayStart, lte: todayEnd }, isCancelled: false },
    include: {
      sessionType: { select: { name: true } },
      instructor: { select: { id: true, name: true, email: true } },
      bookings: { select: { status: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const sessionRows = todaySessions.map((s) => ({
    id: s.id,
    timeLabel: formatMountainTime(s.startsAt, "datetime"),
    sessionTypeName: s.sessionType.name,
    instructorName: s.instructor?.name ?? s.instructor?.email ?? null,
    isMe: s.instructor?.id === userId,
    confirmedCount: s.bookings.filter((b) => b.status === "CONFIRMED").length,
    capacity: s.capacity,
    waitlistCount: s.bookings.filter((b) => b.status === "WAITLIST").length,
  }));

  // My tasks
  const myTasks = await prisma.staffTask.findMany({
    where: { assignedToId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: { linkedCustomer: { select: { name: true } } },
    orderBy: { dueAt: { sort: "asc", nulls: "last" } },
  });

  const now = new Date();
  const taskRows: TaskRow[] = myTasks.slice(0, 5).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as "OPEN" | "IN_PROGRESS",
    dueAtLabel: t.dueAt ? formatMountainTime(t.dueAt, "date") : null,
    overdue: !!t.dueAt && t.dueAt < now,
    linkedCustomerName: t.linkedCustomer?.name ?? null,
  }));

  // My tips this month
  let tipSummary: { totalAmountCents: number; count: number } | null = null;
  if (canViewTips) {
    const monthStart = fromZonedTime(startOfMonth(nowMT), STUDIO_TIMEZONE);
    const monthEnd = fromZonedTime(endOfMonth(nowMT), STUDIO_TIMEZONE);
    const agg = await prisma.tip.aggregate({
      where: { instructorId: userId, createdAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amountInCents: true },
      _count: true,
    });
    tipSummary = { totalAmountCents: agg._sum.amountInCents ?? 0, count: agg._count };
  }

  const quickLinks = [
    { href: canManageSchedule ? "/admin/schedule" : "/schedule", label: "Schedule" },
    ...(canManageTasks ? [{ href: "/admin/tasks", label: "Tasks" }] : []),
    ...(canViewTips ? [{ href: "/staff/tips", label: "Tips" }] : []),
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/inbox", label: "Inbox" },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          {greeting(nowMT.getHours())}, {firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {assignment
            ? `${assignment.staffRole.name} · ${assignment.staffRole.location.name}`
            : "No role assigned"}
        </Typography>
      </Box>

      {/* Today's sessions */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Today&apos;s Sessions
        </Typography>
        {sessionRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No sessions scheduled today.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            {sessionRows.map((s, idx) => (
              <Box key={s.id}>
                {idx > 0 && <Divider />}
                <Box
                  component={canCheckInMembers ? NextLink : "div"}
                  href={canCheckInMembers ? `/staff/sessions/${s.id}` : undefined}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 2.5,
                    py: 1.75,
                    flexWrap: "wrap",
                    textDecoration: "none",
                    color: "inherit",
                    cursor: canCheckInMembers ? "pointer" : "default",
                    "&:hover": canCheckInMembers ? { bgcolor: "action.hover" } : undefined,
                  }}
                >
                  <Box>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.sessionTypeName}
                      </Typography>
                      {s.isMe && (
                        <Chip label="You're teaching" size="small" color="primary" sx={{ height: 20, fontSize: "0.65rem" }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {s.timeLabel} · {s.instructorName ?? "No instructor assigned"}
                    </Typography>
                  </Box>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexShrink: 0 }}>
                    <Chip
                      label={`${s.confirmedCount}/${s.capacity}`}
                      size="small"
                      variant="outlined"
                    />
                    {s.waitlistCount > 0 && (
                      <Chip label={`${s.waitlistCount} waitlisted`} size="small" color="warning" />
                    )}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      {/* My tasks */}
      <TasksCard initialTasks={taskRows} canManageTasks={canManageTasks} />

      {/* My tips this month */}
      {canViewTips && tipSummary && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            My Tips This Month
          </Typography>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {(tipSummary.totalAmountCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tipSummary.count} {tipSummary.count === 1 ? "tip" : "tips"}
                </Typography>
              </Box>
              <Link component={NextLink} href="/staff/tips" underline="always" variant="body2">
                View details
              </Link>
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Quick links */}
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Quick Links
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {quickLinks.map((l) => (
            <Button key={l.href} component={NextLink} href={l.href} variant="outlined" size="small">
              {l.label}
            </Button>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
