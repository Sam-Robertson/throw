import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { mapHref, sessionWhen } from '@/lib/sessionPresentation';
import { CardLink } from '@/components/site/SessionCard';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  PinIcon,
  ShirtIcon,
} from '@/components/site/icons';

export const dynamic = 'force-dynamic';

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/**
 * "Booking confirmed — See you at the wheel" (Membership Portal design):
 * shown right after booking, with the class, what it cost, Add to calendar,
 * directions and the before-you-come notes.
 */
export default async function BookingConfirmedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/bookings/${id}/confirmed`);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true } },
          location: { select: { name: true, address: true } },
        },
      },
    },
  });
  if (!booking || booking.userId !== session.user.id) notFound();

  const s = booking.studioSession;
  const title = s.title ?? s.sessionType.name;
  const address = s.location?.address ?? s.location?.name ?? null;
  const paid =
    booking.source === 'MEMBERSHIP_CREDIT'
      ? '1 class ticket'
      : booking.source === 'MEMBER_FREE'
        ? 'Included in your membership'
        : booking.source === 'COMP'
          ? 'Complimentary'
          : money(booking.amountPaidCents);
  const waitlisted = booking.status === 'WAITLIST';

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10 md:py-14">
      <div className="text-center">
        <CheckCircleIcon className="text-sage mx-auto size-7" />
        <p className="t-body-sm-bold text-headline mt-2">
          {waitlisted ? 'On the waitlist' : 'Booking confirmed'}
        </p>
        <h1 className="t-h-lg text-headline mt-1">
          {waitlisted ? 'We’ll text you if a spot opens' : 'See you at the wheel'}
        </h1>
        <p className="text-body mt-3 text-[14px] leading-5">
          A confirmation email is on its way to
          <br />
          <span className="t-body-sm-bold text-headline">{session.user.email}</span>
        </p>
      </div>

      <div className="mt-8">
        <p className="t-body-sm-bold text-headline">{title}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-body flex items-center gap-2 text-[14px] leading-5">
            <CalendarIcon className="text-headline size-4 shrink-0" />
            {sessionWhen(s.startsAt, s.endsAt)}
          </p>
          {address && (
            <p className="text-body flex items-center gap-2 text-[14px] leading-5">
              <PinIcon className="text-headline size-4 shrink-0" />
              <span className="underline underline-offset-4">{address}</span>
            </p>
          )}
        </div>
        <div className="border-fill mt-5 flex items-center justify-between border-t pt-4">
          <span className="text-body text-[14px] leading-5">Total paid</span>
          <span className="t-body-sm-bold text-headline">{paid}</span>
        </div>
      </div>

      <div className="mt-6">
        <CardLink href={`/api/bookings/${booking.id}/calendar`} download>
          Add to calendar
        </CardLink>
        {s.location?.address && (
          <a
            href={mapHref(s.location.address)}
            target="_blank"
            rel="noreferrer"
            className="t-body-sm-bold text-headline mt-4 block text-center"
          >
            Get directions
          </a>
        )}
      </div>

      <div className="mt-10">
        <h2 className="t-body-sm-bold text-headline">Before you come</h2>
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <ClockIcon className="text-headline mt-0.5 size-5 shrink-0" />
            <p className="text-body text-[14px] leading-5">
              Arrive 10 minutes early so we can get you settled at a wheel.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShirtIcon className="text-headline mt-0.5 size-5 shrink-0" />
            <p className="text-body text-[14px] leading-5">
              Wear clothes that you would be okay getting clay on. (Don’t worry, clay washes out)
            </p>
          </div>
        </div>
      </div>

      <p className="text-body mt-10 text-center text-[13px] leading-5">
        Plans change? Cancel at least 2 hours ahead so another member can take your spot.
      </p>
    </div>
  );
}
