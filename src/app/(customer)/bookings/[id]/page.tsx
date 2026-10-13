import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { mapHref, sessionKicker, sessionPhoto, sessionWhen } from '@/lib/sessionPresentation';
import { SessionDetail, StatusChip } from '@/components/site/SessionDetail';
import { CardLink } from '@/components/site/SessionCard';
import { SitePhoto } from '@/components/site/SitePhoto';
import { BackLink } from '@/components/shared/BackLink';
import { CancelBooking } from './_components/CancelBooking';

export const dynamic = 'force-dynamic';

async function getOwnBooking(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true, description: true, membersOnly: true, kind: true } },
          location: { select: { name: true, address: true } },
          instructor: { select: { name: true } },
        },
      },
    },
  });
  if (!booking || booking.userId !== userId) return null;
  return booking;
}

/**
 * One booking in My classes (Membership Portal design): the class, its
 * status, Add to calendar, and "Can't make it? Cancel this booking" while
 * it is still ahead.
 */
export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/bookings/${id}`);

  const booking = await getOwnBooking(id, session.user.id);
  if (!booking) notFound();

  const s = booking.studioSession;
  const now = new Date();
  const cancelled = booking.status === 'CANCELLED' || s.isCancelled;
  const upcoming = !cancelled && s.startsAt > now;
  const canCancel = upcoming && s.startsAt > new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const title = s.title ?? s.sessionType.name;
  const address = s.location?.address ?? s.location?.name ?? null;

  return (
    <div className="mx-auto w-full max-w-lg md:py-8">
      <SitePhoto
        photo={sessionPhoto(s.sessionType)}
        priority
        sizes="(min-width: 768px) 512px, 100vw"
        className="bg-fill aspect-[16/10] w-full md:rounded-2xl"
      />
      <div className="px-6 py-6">
        <div className="mb-4">
          <BackLink href="/bookings">My classes</BackLink>
        </div>
        <SessionDetail
          chip={
            cancelled ? (
              <StatusChip tone="rust">Cancelled</StatusChip>
            ) : booking.status === 'WAITLIST' ? (
              <StatusChip tone="grey">On the waitlist</StatusChip>
            ) : upcoming ? (
              <StatusChip tone="sage">Booked</StatusChip>
            ) : (
              <StatusChip tone="sage">Attended</StatusChip>
            )
          }
          title={title}
          kicker={sessionKicker(s.sessionType)}
          instructor={s.instructor?.name}
          when={sessionWhen(s.startsAt, s.endsAt)}
          address={address}
          mapHref={s.location?.address ? mapHref(s.location.address) : null}
          description={s.sessionType.description}
          goodToKnow={upcoming ? undefined : null}
        >
          {upcoming && (
            <div className="mt-8">
              <CardLink href={`/api/bookings/${booking.id}/calendar`} download>
                Add to calendar
              </CardLink>
              {canCancel && (
                <CancelBooking
                  bookingId={booking.id}
                  usedTicket={booking.source === 'MEMBERSHIP_CREDIT'}
                  summary={{
                    kicker: sessionKicker(s.sessionType),
                    title,
                    when: sessionWhen(s.startsAt, s.endsAt),
                    address,
                  }}
                />
              )}
            </div>
          )}
        </SessionDetail>
      </div>
    </div>
  );
}
