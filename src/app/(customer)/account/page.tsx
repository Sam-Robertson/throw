import NextLink from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isSuppressed, normalizePhone, normalizeEmail } from '@/lib/consent';
import { getTicketBalance } from '@/lib/credits';
import { billingIntervalFromDays } from '@/lib/billingInterval';
import { formatCents } from '@/lib/membershipLifecycle';
import { ChevronRight } from '@/components/site/icons';
import { ProfileSection } from './_components/ProfileSection';
import { MarketingPreferences } from './_components/MarketingPreferences';
import { DeleteAccount } from './_components/DeleteAccount';

export const dynamic = 'force-dynamic';

/**
 * "My account" (design files: My account / Edit name / Edit email / Emergency
 * contact). Profile rows open an edit sheet each; credit and tickets are read
 * only here (tickets link to the membership); marketing switches save as
 * they are flipped.
 */
export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      accountCreditCents: true,
      smsMarketingOptIn: true,
      emailMarketingOptIn: true,
      hashedPassword: true,
    },
  });
  if (!user) redirect('/login');

  const [smsSuppressed, emailSuppressed, membership] = await Promise.all([
    user.phone ? isSuppressed('SMS', normalizePhone(user.phone)) : Promise.resolve(false),
    isSuppressed('EMAIL', normalizeEmail(user.email)),
    prisma.membership.findFirst({
      where: { userId: session.user.id, status: { in: ['ACTIVE', 'PAUSED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, plan: { select: { billingIntervalDays: true } } },
    }),
  ]);
  const tickets = membership ? await getTicketBalance(membership.id) : null;

  let ticketsLine: string;
  let ticketsHref: string;
  if (!membership || !tickets) {
    ticketsLine = 'No membership';
    ticketsHref = '/membership/pick';
  } else if (membership.status === 'PAUSED') {
    ticketsLine = 'Membership paused';
    ticketsHref = '/membership/manage';
  } else if (tickets.unlimited) {
    ticketsLine = 'Unlimited';
    ticketsHref = '/membership/manage';
  } else {
    const monthly = billingIntervalFromDays(membership.plan.billingIntervalDays).unit === 'month';
    ticketsLine = `${Math.max(0, tickets.balance ?? 0)} left this ${monthly ? 'month' : 'period'}`;
    ticketsHref = '/membership/manage';
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-8 md:py-12">
      <h1 className="t-h-xl text-headline">My account</h1>

      <ProfileSection
        user={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          emergencyContactName: user.emergencyContactName,
          emergencyContactPhone: user.emergencyContactPhone,
          hasPassword: user.hashedPassword !== null,
        }}
      />

      <section className="mt-10">
        <h2 className="text-headline text-2xl font-bold">Credit and tickets</h2>
        <div className="mt-2">
          <div className="flex items-center justify-between py-4">
            <span>
              <span className="t-body-sm text-body block">Throw credit</span>
              <span className="t-body-sm-bold text-headline block">{formatCents(user.accountCreditCents)}</span>
            </span>
          </div>
          <NextLink href={ticketsHref} className="flex items-center justify-between py-4">
            <span>
              <span className="t-body-sm text-body block">Class tickets</span>
              <span className="t-body-sm-bold text-headline block">{ticketsLine}</span>
            </span>
            <ChevronRight className="text-headline size-5 shrink-0" />
          </NextLink>
        </div>
      </section>

      <MarketingPreferences
        initialSms={user.smsMarketingOptIn}
        initialEmail={user.emailMarketingOptIn}
        smsSuppressed={smsSuppressed}
        emailSuppressed={emailSuppressed}
      />

      <DeleteAccount />
    </div>
  );
}
