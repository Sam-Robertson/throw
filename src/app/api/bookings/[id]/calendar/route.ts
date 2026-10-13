import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { bookingIcs } from '@/lib/calendar';

/** GET /api/bookings/[id]/calendar — the booking as a .ics file ("Add to calendar"). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true, description: true } },
          location: { select: { name: true, address: true } },
        },
      },
    },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.userId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const s = booking.studioSession;
  const title = s.title ?? s.sessionType.name;
  const location = s.location
    ? [s.location.name, s.location.address].filter(Boolean).join(', ')
    : null;
  const ics = bookingIcs({
    uid: booking.id,
    title: `${title} at Throw`,
    description: s.sessionType.description,
    location,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="throw-${booking.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
