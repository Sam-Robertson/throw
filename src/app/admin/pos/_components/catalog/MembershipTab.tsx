'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import { formatMoney, type CustomerSummary, type PosOrder } from '../types';

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

/**
 * Lookup only. Memberships are sold online until the billing migration, so
 * nothing here adds a line to the order.
 */
export function MembershipTab({
  order,
  summary,
  summaryLoading,
  summaryError,
}: {
  order: PosOrder | null;
  summary: CustomerSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
}) {
  const note = (
    <p className="text-xs text-muted-foreground">
      Memberships are sold online only for now, so they can&apos;t be added to an order here. Point the
      customer to the website to join or change plans.
    </p>
  );

  if (!order?.customerId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Attach a customer to the order to see their membership, tickets and credit.
        </p>
        {note}
      </div>
    );
  }

  if (summaryError) {
    return <p className="rounded-lg border p-4 text-sm text-destructive">{summaryError}</p>;
  }
  if (summaryLoading || !summary) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading membership…</p>;
  }

  const { membership, tickets } = summary;
  const name = summary.customer.name ?? summary.customer.email;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{name}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact
          label="Plan"
          value={membership ? membership.planName : 'No membership'}
          detail={
            membership
              ? `${membership.status === 'ACTIVE' ? 'Active' : 'Paused'} · ${
                  membership.status === 'ACTIVE' ? 'renews' : 'period ends'
                } ${formatInTimeZone(membership.currentPeriodEnd, STUDIO_TIMEZONE, 'MMM d, yyyy')}${
                  membership.commitmentMonths ? ` · ${membership.commitmentMonths} month commitment` : ''
                }`
              : undefined
          }
        />
        <Fact
          label="Class tickets"
          value={tickets ? (tickets.unlimited ? 'Unlimited' : String(tickets.remaining ?? 0)) : '—'}
          detail={tickets ? 'remaining this period' : 'Tickets come with a membership'}
        />
        <Fact label="Class pack credits" value={String(summary.classPackCredits)} detail="never expire" />
        <Fact label="Account credit" value={formatMoney(summary.accountCreditCents)} />
      </div>
      {note}
    </div>
  );
}
