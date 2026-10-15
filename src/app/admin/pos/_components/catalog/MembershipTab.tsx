'use client';

import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { STUDIO_TIMEZONE } from '@/lib/timezone';
import {
  formatMoney,
  type CommitmentTermCatalogItem,
  type CustomerSummary,
  type MembershipPlanCatalogItem,
  type PosCatalog,
  type PosOrder,
} from '../types';

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

function periodWord(days: number): string {
  if (days === 28 || days === 30 || days === 31) return 'month';
  if (days === 7) return 'week';
  if (days === 365 || days === 366) return 'year';
  return `${days} days`;
}

function termPerks(term: CommitmentTermCatalogItem, firstTimeMember: boolean): string[] {
  const perks: string[] = [];
  if (firstTimeMember) {
    perks.push(term.joiningFeeCents > 0 ? `${formatMoney(term.joiningFeeCents)} joining fee` : 'No joining fee');
  }
  if (term.retailDiscountPercent > 0) perks.push(`${term.retailDiscountPercent}% off retail`);
  if (term.includesGuestPass) perks.push('Guest pass included');
  if (term.freeMonths > 0) perks.push(`${term.freeMonths} month${term.freeMonths === 1 ? '' : 's'} free`);
  return perks;
}

/**
 * Looks the attached customer's membership up, and starts one when they have
 * none: pick a plan and a commitment, and the first period (plus the joining
 * fee for a first-ever member) goes on the order. The subscription starts in
 * Stripe when the order is paid (src/lib/posMembership.ts).
 */
export function MembershipTab({
  catalog,
  order,
  busy,
  summary,
  summaryLoading,
  summaryError,
  onAddMembership,
}: {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  summary: CustomerSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  onAddMembership: (planId: string, commitmentTermId: string | null) => void;
}) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);

  if (!order?.customerId) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Attach a customer to the order to see their membership or start one for them.
        </p>
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

  if (membership) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{name}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact
            label="Plan"
            value={membership.planName}
            detail={`${membership.status === 'ACTIVE' ? 'Active' : 'Paused'} · ${
              membership.status === 'ACTIVE' ? 'renews' : 'period ends'
            } ${formatInTimeZone(membership.currentPeriodEnd, STUDIO_TIMEZONE, 'MMM d, yyyy')}${
              membership.commitmentMonths ? ` · ${membership.commitmentMonths} month commitment` : ''
            }`}
          />
          <Fact
            label="Class tickets"
            value={tickets ? (tickets.unlimited ? 'Unlimited' : String(tickets.remaining ?? 0)) : '—'}
            detail={tickets ? 'remaining this period' : 'Tickets come with a membership'}
          />
          <Fact label="Class pack credits" value={String(summary.classPackCredits)} detail="never expire" />
          <Fact label="Account credit" value={formatMoney(summary.accountCreditCents)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Plan changes, pauses and cancellations are done from the customer&apos;s page.
        </p>
      </div>
    );
  }

  const plans = catalog?.membershipPlans ?? [];
  const terms = catalog?.commitmentTerms ?? [];
  const onOrder = order.items.some((i) => i.itemType === 'MEMBERSHIP');
  const selectedPlan: MembershipPlanCatalogItem | null = plans.find((p) => p.id === planId) ?? null;
  const selectedTerm = terms.find((t) => t.id === termId) ?? terms.find((t) => t.months === null) ?? terms[0] ?? null;
  const firstTimeMember = !summary.everMember;
  const joiningFee = firstTimeMember ? (selectedTerm ? selectedTerm.joiningFeeCents : (selectedPlan?.joiningFeeCents ?? 0)) : 0;
  const todayCents = selectedPlan ? selectedPlan.priceInCents + joiningFee : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{name}</h3>
        <span className="text-sm text-muted-foreground">No membership yet</span>
      </div>

      {onOrder ? (
        <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          A membership is on this order. It starts, and the welcome text goes out, when the order is paid.
        </p>
      ) : !catalog ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading the plans…</p>
      ) : plans.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No plans are on sale at this studio.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {plans.map((plan) => {
              const selected = plan.id === planId;
              const facts = [
                plan.classTicketsPerPeriod == null ? 'Unlimited classes' : `${plan.classTicketsPerPeriod} class tickets`,
                plan.shelfType === 'FULL' ? 'Full shelf' : plan.shelfType === 'HALF' ? 'Half shelf' : null,
              ].filter(Boolean);
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={busy || plan.soldOut}
                  onClick={() => setPlanId(selected ? null : plan.id)}
                  aria-pressed={selected}
                  className={`flex min-h-16 flex-col items-start gap-0.5 rounded-lg border p-3 text-left disabled:opacity-50 ${
                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'
                  }`}
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-medium">{plan.name}</span>
                    <span className="shrink-0 text-sm">
                      {formatMoney(plan.priceInCents)} / {periodWord(plan.billingIntervalDays)}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {plan.soldOut ? 'Sold out' : facts.join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedPlan && terms.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium">Commitment</legend>
              {terms.map((term) => {
                const checked = selectedTerm?.id === term.id;
                const perks = termPerks(term, firstTimeMember);
                return (
                  <label
                    key={term.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${
                      checked ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pos-commitment-term"
                      checked={checked}
                      onChange={() => setTermId(term.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{term.name}</span>
                      {perks.length > 0 && (
                        <span className="block text-xs text-muted-foreground">{perks.join(' · ')}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {selectedPlan && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="flex justify-between">
                <span>First {periodWord(selectedPlan.billingIntervalDays)}</span>
                <span>{formatMoney(selectedPlan.priceInCents)}</span>
              </p>
              {joiningFee > 0 && (
                <p className="flex justify-between">
                  <span>Joining fee (first membership)</span>
                  <span>{formatMoney(joiningFee)}</span>
                </p>
              )}
              <p className="mt-1 flex justify-between border-t pt-1 font-semibold">
                <span>Today</span>
                <span>{formatMoney(todayCents)}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Pay by card to save it for the renewals. Then it renews on its own
                {selectedPlan.billingAnchorDay ? ` on the ${selectedPlan.billingAnchorDay === 1 ? '1st' : `${selectedPlan.billingAnchorDay}th`}` : ''}.
                The membership waiver must be signed first.
              </p>
            </div>
          )}

          <Button
            className="min-h-11"
            disabled={busy || !selectedPlan}
            onClick={() => {
              if (!selectedPlan) return;
              onAddMembership(selectedPlan.id, selectedTerm?.id ?? null);
              setPlanId(null);
            }}
          >
            {selectedPlan ? `Add ${selectedPlan.name} membership · ${formatMoney(todayCents)}` : 'Choose a plan'}
          </Button>
        </>
      )}
    </div>
  );
}
