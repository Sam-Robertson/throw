import { notFound, redirect } from 'next/navigation';
import NextLink from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getTicketBalance } from '@/lib/credits';
import { CLASS_PRICE_SELECT, isSellable, resolveClassPriceCents } from '@/lib/sellable';
import { findUnsignedWaiver, waiverSignUrl } from '@/lib/waivers';
import { mapHref, sessionKicker, sessionPhoto, sessionWhen } from '@/lib/sessionPresentation';
import { SessionDetail, StatusChip } from '@/components/site/SessionDetail';
import { SitePhoto } from '@/components/site/SitePhoto';
import { BackLink } from '@/components/shared/BackLink';
import { BookingForm } from './_components/BookingForm';

export const dynamic = 'force-dynamic';

async function getSession(id: string) {
  return prisma.studioSession.findUnique({
    where: { id },
    include: {
      sessionType: {
        select: {
          ...CLASS_PRICE_SELECT,
          name: true,
          description: true,
          kind: true,
          durationMinutes: true,
        },
      },
      location: { select: { name: true, address: true } },
      instructor: { select: { name: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
  });
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8 md:py-12">
      <BackLink href="/book">Choose a class</BackLink>
      <h1 className="t-h-lg text-headline mt-4">{title}</h1>
      <p className="t-body-sm text-body mt-2">{body}</p>
      <NextLink
        href="/bookings"
        className="t-body-sm-bold text-headline mt-4 inline-block underline underline-offset-4"
      >
        My classes
      </NextLink>
    </div>
  );
}

/**
 * A class page in the portal (Membership Portal design, Book): photo, the
 * details, and "Book with 1 class ticket" (or the paid drop-in path for
 * non-members and members out of tickets).
 */
export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) redirect(`/login?callbackUrl=/book/${id}`);
  const userId = authSession.user.id;

  const studioSession = await getSession(id);
  if (!studioSession) notFound();
  const priceCents = resolveClassPriceCents({
    sessionType: studioSession.sessionType,
    locationId: studioSession.locationId,
    priceCentsOverride: studioSession.priceCentsOverride,
  });

  if (studioSession.isCancelled) {
    return (
      <Notice
        title="This class was cancelled"
        body="It can't be booked. Pick another from the list."
      />
    );
  }
  if (studioSession.startsAt <= new Date()) {
    return (
      <Notice
        title="This class has started"
        body="It can no longer be booked. Pick another time."
      />
    );
  }

  // Same per-studio waiver lookup the booking APIs enforce.
  const unsignedWaiver = await findUnsignedWaiver(userId, studioSession.locationId, 'CLASS', {
    sessionTypeId: studioSession.sessionType.id,
    sessionKind: studioSession.sessionType.kind,
  });
  if (unsignedWaiver) redirect(waiverSignUrl(unsignedWaiver.id, `/book/${id}`));

  const existingBooking = await prisma.booking.findFirst({
    where: { userId, studioSessionId: id, status: { not: 'CANCELLED' } },
    select: { id: true, status: true },
  });

  const activeMembership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
    select: { id: true },
  });
  const ticketBalance = activeMembership ? await getTicketBalance(activeMembership.id) : null;
  const spotsRemaining = studioSession.capacity - studioSession._count.bookings;

  const { sessionType } = studioSession;
  const title = studioSession.title ?? sessionType.name;
  const address = studioSession.location?.address ?? studioSession.location?.name ?? null;

  return (
    <div className="mx-auto w-full max-w-lg md:py-8">
      <SitePhoto
        photo={sessionPhoto(sessionType)}
        priority
        sizes="(min-width: 768px) 512px, 100vw"
        className="bg-fill aspect-[16/10] w-full md:rounded-2xl"
      />
      <div className="px-6 py-6">
        <div className="mb-4">
          <BackLink href="/book">Choose a class</BackLink>
        </div>
        <SessionDetail
          chip={
            existingBooking ? (
              <StatusChip tone={existingBooking.status === 'WAITLIST' ? 'grey' : 'sage'}>
                {existingBooking.status === 'WAITLIST' ? 'On the waitlist' : 'Booked'}
              </StatusChip>
            ) : null
          }
          title={title}
          kicker={sessionKicker(sessionType)}
          instructor={studioSession.instructor?.name}
          when={sessionWhen(studioSession.startsAt, studioSession.endsAt)}
          address={address}
          mapHref={studioSession.location?.address ? mapHref(studioSession.location.address) : null}
          description={sessionType.description}
        >
          <div className="mt-8">
            {existingBooking ? (
              <NextLink
                href={`/bookings/${existingBooking.id}`}
                className="bg-sage flex h-12 w-full items-center justify-center rounded-full text-base font-bold text-white"
              >
                See my booking
              </NextLink>
            ) : (
              <BookingForm
                sessionId={id}
                hasMembership={activeMembership !== null}
                membershipUnlimited={ticketBalance?.unlimited ?? false}
                ticketsRemaining={
                  ticketBalance && !ticketBalance.unlimited
                    ? Math.max(0, ticketBalance.balance ?? 0)
                    : null
                }
                dropInPriceCents={priceCents}
                forSale={isSellable(sessionType, priceCents)}
                spotsRemaining={spotsRemaining}
              />
            )}
          </div>
        </SessionDetail>
      </div>
    </div>
  );
}
