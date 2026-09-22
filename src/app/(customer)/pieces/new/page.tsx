import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { PieceForm, type SessionOption } from "./_components/PieceForm";

// How far back the session picker looks.
const SESSION_LOOKBACK_DAYS = 60;

export default async function NewPiecePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: requestedSessionId } = await searchParams;
  const session = await auth();
  if (!session) {
    const back = requestedSessionId
      ? `/pieces/new?session=${encodeURIComponent(requestedSessionId)}`
      : "/pieces/new";
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
  }
  const userId = session.user.id;
  const now = new Date();

  const bookingInclude = {
    studioSession: {
      select: {
        id: true,
        startsAt: true,
        sessionType: { select: { name: true } },
        location: { select: { name: true } },
        instructor: { select: { name: true } },
      },
    },
  } as const;

  const [user, bookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    prisma.booking.findMany({
      where: {
        userId,
        status: { not: "CANCELLED" },
        studioSession: { startsAt: { gte: subDays(now, SESSION_LOOKBACK_DAYS), lte: now } },
      },
      include: bookingInclude,
      orderBy: { studioSession: { startsAt: "desc" } },
      take: 20,
    }),
  ]);

  // A linked session older than the lookback window is still valid if it's theirs.
  if (requestedSessionId && !bookings.some((b) => b.studioSessionId === requestedSessionId)) {
    const requested = await prisma.booking.findFirst({
      where: { userId, studioSessionId: requestedSessionId, status: { not: "CANCELLED" } },
      include: bookingInclude,
    });
    if (requested) bookings.unshift(requested);
  }

  const seen = new Set<string>();
  const sessions: SessionOption[] = [];
  for (const b of bookings) {
    if (seen.has(b.studioSessionId)) continue;
    seen.add(b.studioSessionId);
    sessions.push({
      id: b.studioSessionId,
      label: `${b.studioSession.sessionType.name} — ${formatMountainTime(b.studioSession.startsAt, "datetime")}${
        b.studioSession.location ? ` · ${b.studioSession.location.name}` : ""
      }`,
      instructorName: b.studioSession.instructor?.name ?? null,
    });
  }

  // Default: the linked session if valid, else the most recent attended one
  // (latest past CONFIRMED booking).
  const defaultSessionId =
    (requestedSessionId && seen.has(requestedSessionId) ? requestedSessionId : null) ??
    bookings.find((b) => b.status === "CONFIRMED" && b.studioSession.startsAt <= now)?.studioSessionId ??
    "";

  return (
    <Container maxWidth="sm" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      <Typography variant="h2" sx={{ fontWeight: 700 }}>
        Log your pieces
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        Tell us what you made so we can track it through drying and firing.
      </Typography>
      <PieceForm
        userId={userId}
        sessions={sessions}
        defaultSessionId={defaultSessionId}
        defaultPhone={user?.phone ?? ""}
      />
    </Container>
  );
}
