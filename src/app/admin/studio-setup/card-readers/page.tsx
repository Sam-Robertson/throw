import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CardReadersClient } from './_components/CardReadersClient';

export const dynamic = 'force-dynamic';

export default async function CardReadersPage() {
  const session = await auth();
  if (!session) redirect('/login');
  // Pairing a reader changes Stripe-side configuration, so it stays admin-only
  // even though using a reader only needs canUsePos.
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, stripeTerminalLocationId: true },
  });

  return <CardReadersClient locations={locations} />;
}
