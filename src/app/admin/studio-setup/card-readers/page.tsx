import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeAccountForStudio, studioHasOwnStripeAccount } from '@/lib/stripeAccounts';
import { CardReadersClient } from './_components/CardReadersClient';

export const dynamic = 'force-dynamic';

export default async function CardReadersPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Pairing a reader changes Stripe-side configuration, so it stays admin-only
  // even though using a reader only needs canUsePos.
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const rows = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, stripeTerminalLocationId: true },
  });

  // Which Stripe account each studio's readers (and sales) go through, so the
  // screen can say so: a studio without a key of its own shares the default
  // account, which is easy to miss when a second studio opens.
  const locations = rows.map((l) => {
    const account = stripeAccountForStudio(l.name);
    return {
      ...l,
      stripeAccount: {
        label: studioHasOwnStripeAccount(l.name) ? `${l.name}'s own` : 'the default',
        live: account.live,
        shared: !studioHasOwnStripeAccount(l.name),
      },
    };
  });

  return <CardReadersClient locations={locations} />;
}
