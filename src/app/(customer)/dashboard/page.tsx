import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getTicketBalance } from '@/lib/credits';
import { findUnsignedWaiver, waiverSignUrl } from '@/lib/waivers';
import { Button } from '@/components/site/Button';
import {
  CalendarIcon,
  ChevronRight,
  RosetteIcon,
  TicketIcon,
  UserIcon,
} from '@/components/site/icons';
import { SignOutButton } from './_components/SignOutButton';

export const dynamic = 'force-dynamic';

/**
 * The customer hub ("Welcome Sydney" in the Membership Portal design): four
 * rows that lead to using a class ticket, My classes, My membership and My
 * account, then "Pay for a glaze firing" and "Buy clay".
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');
  const userId = session.user.id;
  const now = new Date();

  const [membership, unsignedWaiver, upcomingCount] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } },
      include: { plan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    findUnsignedWaiver(userId, null),
    prisma.booking.count({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'WAITLIST'] },
        studioSession: { startsAt: { gte: now } },
      },
    }),
  ]);
  const tickets =
    membership && membership.status === 'ACTIVE' ? await getTicketBalance(membership.id) : null;

  let ticketsLine: string;
  if (!membership) ticketsLine = 'Members book with class tickets';
  else if (membership.status === 'PAUSED') ticketsLine = 'Membership paused';
  else if (!tickets || tickets.unlimited) ticketsLine = 'Unlimited classes';
  else ticketsLine = `${Math.max(0, tickets.balance ?? 0)} tickets left this month`;

  const firstName = session.user.name?.trim().split(/\s+/)[0] ?? null;

  const rows = [
    {
      href: '/book',
      icon: TicketIcon,
      title: 'Use a class ticket',
      line: ticketsLine,
    },
    {
      href: '/bookings',
      icon: CalendarIcon,
      title: 'My classes',
      line: `${upcomingCount} upcoming ${upcomingCount === 1 ? 'event' : 'events'}`,
    },
    {
      href: membership ? '/membership/manage' : '/membership/pick',
      icon: RosetteIcon,
      title: 'My Membership',
      line: membership
        ? `${membership.plan.name}${membership.status === 'PAUSED' ? ' · Paused' : ''}`
        : 'No membership yet',
    },
    { href: '/account', icon: UserIcon, title: 'My account', line: null },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-160px)] w-full max-w-lg flex-col px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">{firstName ? `Welcome ${firstName}` : 'Welcome'}</h1>

      {unsignedWaiver && (
        <NextLink
          href={waiverSignUrl(unsignedWaiver.id, '/dashboard')}
          className="bg-sage-fill border-sage-stroke mt-6 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        >
          <span>
            <span className="t-body-sm-bold text-headline block">Sign your waiver</span>
            <span className="text-body block text-[14px] leading-5">
              Needed before your first class.
            </span>
          </span>
          <ChevronRight className="text-headline size-5 shrink-0" />
        </NextLink>
      )}

      <div className="mt-6 flex flex-col">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <NextLink
              key={r.href}
              href={r.href}
              className="border-fill flex items-center justify-between gap-4 border-b py-4 last:border-b-0"
            >
              <span className="flex items-center gap-3">
                <Icon className="text-headline size-5 shrink-0" />
                <span>
                  <span className="t-body-sm-bold text-headline block">{r.title}</span>
                  {r.line && (
                    <span className="text-body block text-[14px] leading-5">{r.line}</span>
                  )}
                </span>
              </span>
              <ChevronRight className="text-headline size-5 shrink-0" />
            </NextLink>
          );
        })}
      </div>

      <div className="mt-6">
        <Button href="/buy/firing" block>
          Pay for a glaze firing
        </Button>
        <NextLink
          href="/buy/clay"
          className="t-body-sm-bold text-headline hover:text-sage mt-4 block text-center transition-colors"
        >
          Buy clay
        </NextLink>
      </div>

      <div className="mt-auto pt-12 text-center">
        <SignOutButton />
      </div>
    </div>
  );
}
