import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getTicketBalance } from '@/lib/credits';
import { mapHref, sessionKicker, sessionPhoto, sessionWhen } from '@/lib/sessionPresentation';
import { SessionCard, CardLink } from '@/components/site/SessionCard';
import { SitePhoto } from '@/components/site/SitePhoto';
import { TicketIcon } from '@/components/site/icons';
import { BackLink } from '@/components/shared/BackLink';

export const dynamic = 'force-dynamic';

/**
 * "Choose a class" (Membership Portal design, Book): every upcoming class
 * and workshop a member can book with a class ticket, as cards. Each card's
 * Learn more opens the class page, which does the booking.
 */
export default async function ChooseClassPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/book');
  const userId = session.user.id;

  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
    select: { id: true, locationId: true },
  });
  const tickets = membership ? await getTicketBalance(membership.id) : null;

  // Upcoming, not cancelled, a class type that is still offered, and
  // bookable with a ticket (the session's own setting wins over the type's).
  const sessions = (
    await prisma.studioSession.findMany({
      where: {
        startsAt: { gte: new Date() },
        isCancelled: false,
        sessionType: { isActive: true, archivedAt: null, isBusyWindow: false },
      },
      include: {
        sessionType: {
          select: {
            name: true,
            description: true,
            membersOnly: true,
            kind: true,
            isTicketEligible: true,
          },
        },
        location: { select: { id: true, name: true, address: true } },
        instructor: { select: { name: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 60,
    })
  ).filter((s) => s.isTicketEligibleOverride ?? s.sessionType.isTicketEligible);

  let ticketsLine: string;
  if (!membership) ticketsLine = 'You need a membership to book with class tickets';
  else if (!tickets || tickets.unlimited) ticketsLine = 'Unlimited classes on your membership';
  else {
    const n = Math.max(0, tickets.balance ?? 0);
    ticketsLine = `${n} ${n === 1 ? 'ticket' : 'tickets'} available`;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8 md:py-12">
      <BackLink href="/dashboard">Home</BackLink>
      <h1 className="t-h-xl text-headline mt-4">Choose a class</h1>
      <p className="text-body mt-2 text-[14px] leading-5">
        All workshops and classes cost 1 class ticket
      </p>
      <p className="t-body-sm-bold text-headline mt-2 flex items-center gap-2">
        <TicketIcon className="size-5" />
        {ticketsLine}
      </p>
      {!membership && (
        <NextLink
          href="/membership/pick"
          className="t-body-sm-bold text-sage mt-2 inline-block underline underline-offset-4"
        >
          Start a membership
        </NextLink>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {sessions.length === 0 && (
          <p className="t-body-sm text-body">Nothing on the calendar yet. Check back soon.</p>
        )}
        {sessions.map((s) => {
          const photo = sessionPhoto(s.sessionType);
          const blurb = s.sessionType.description
            ? s.sessionType.description.length > 150
              ? `${s.sessionType.description.slice(0, 147).trimEnd()}…`
              : s.sessionType.description
            : null;
          return (
            <SessionCard
              key={s.id}
              photo={
                <SitePhoto
                  photo={photo}
                  sizes="(min-width: 768px) 512px, 100vw"
                  className="bg-fill aspect-[16/9] w-full"
                />
              }
              kicker={sessionKicker(s.sessionType)}
              title={s.title ?? s.sessionType.name}
              when={sessionWhen(s.startsAt, s.endsAt)}
              address={s.location?.address ?? s.location?.name ?? null}
              mapHref={s.location?.address ? mapHref(s.location.address) : null}
              blurb={blurb}
              action={<CardLink href={`/book/${s.id}`}>Learn more</CardLink>}
            />
          );
        })}
      </div>
    </div>
  );
}
