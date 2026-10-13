import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  mapHref,
  sessionDayLabel,
  sessionKicker,
  sessionPhoto,
  sessionWhen,
} from '@/lib/sessionPresentation';
import { SitePhoto } from '@/components/site/SitePhoto';
import { BackLink } from '@/components/shared/BackLink';
import { MyClasses, type ClassRow } from './_components/MyClasses';

export const dynamic = 'force-dynamic';

const INCLUDE = {
  studioSession: {
    include: {
      sessionType: { select: { name: true, description: true, membersOnly: true, kind: true } },
      location: { select: { name: true, address: true } },
      instructor: { select: { name: true } },
    },
  },
} as const;

/**
 * "My classes" (Membership Portal design): Upcoming as cards with Add to
 * calendar, Past and Cancelled as compact rows. The three lists are loaded
 * here and the tabs switch between them on the client.
 */
export default async function MyClassesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/bookings');
  const userId = session.user.id;
  const now = new Date();

  const [upcoming, past, cancelled] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
        studioSession: { startsAt: { gte: now } },
      },
      include: INCLUDE,
      orderBy: { studioSession: { startsAt: 'asc' } },
      take: 50,
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'NO_SHOW'] },
        studioSession: { startsAt: { lt: now } },
      },
      include: INCLUDE,
      orderBy: { studioSession: { startsAt: 'desc' } },
      take: 50,
    }),
    prisma.booking.findMany({
      where: { userId, status: 'CANCELLED' },
      include: INCLUDE,
      orderBy: { studioSession: { startsAt: 'desc' } },
      take: 50,
    }),
  ]);

  const toRow = (b: (typeof upcoming)[number]): ClassRow => {
    const s = b.studioSession;
    const blurb = s.sessionType.description
      ? s.sessionType.description.length > 120
        ? `${s.sessionType.description.slice(0, 117).trimEnd()}… `
        : s.sessionType.description
      : null;
    return {
      id: b.id,
      status: b.status,
      kicker: sessionKicker(s.sessionType),
      title: s.title ?? s.sessionType.name,
      when: sessionWhen(s.startsAt, s.endsAt),
      day: sessionDayLabel(s.startsAt),
      address: s.location?.address ?? s.location?.name ?? null,
      mapHref: s.location?.address ? mapHref(s.location.address) : null,
      blurb,
      photo: (
        <SitePhoto
          photo={sessionPhoto(s.sessionType)}
          sizes="(min-width: 768px) 512px, 100vw"
          className="bg-fill aspect-[16/9] w-full"
        />
      ),
    };
  };

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8 md:py-12">
      <BackLink href="/dashboard">Home</BackLink>
      <h1 className="t-h-xl text-headline mt-4">My classes</h1>
      <MyClasses
        upcoming={upcoming.map(toRow)}
        past={past.map(toRow)}
        cancelled={cancelled.map(toRow)}
      />
    </div>
  );
}
