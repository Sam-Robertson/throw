import NextLink from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { shortLocationName } from '@/lib/locationName';
import { PURCHASABLE_PLAN_WHERE, getCapGroupUsage } from '@/lib/membershipCatalog';
import {
  formatDollarsShort,
  shelfLine,
  shortPeriodLabel,
  ticketsLine,
} from '@/lib/membershipLifecycle';
import { FaqList } from '@/components/site/FaqList';
import { ReviewsSection } from '@/components/site/ReviewsSection';
import { SitePhoto } from '@/components/site/SitePhoto';
import { CheckIcon } from '@/components/site/icons';
import {
  CLAY_PRICING,
  MEMBERSHIP_EXCLUDES,
  MEMBERSHIP_FAQS,
  MEMBERSHIP_HERO,
  MEMBERSHIP_INCLUDES,
  type PricedItem,
} from '@/content/membership';
import { MembershipPlans } from './_components/MembershipPlans';

export const dynamic = 'force-dynamic';

/**
 * Public Memberships page, to the "Membership PDP" design (Oct 2026): a split
 * hero (photo left, what's included right), "Choose a membership" with the
 * plans as option cards, the clay and glaze firing price card, reviews, FAQs.
 *
 * Plans come from the database: the purchasable ones, grouped by studio, with
 * a capped (founding) plan dropping out once its cap group is full. The
 * joining-fee line is read from the commitment terms the same way checkout
 * charges it.
 */
export default async function MembershipPage() {
  const session = await auth();

  const allPlans = await prisma.membershipPlan.findMany({
    where: PURCHASABLE_PLAN_WHERE,
    orderBy: [{ isFounding: 'desc' }, { price: 'asc' }],
    include: { location: { select: { id: true, name: true, address: true, createdAt: true } } },
  });
  const capUsage = await getCapGroupUsage(
    allPlans.flatMap((p) => (p.capGroupId ? [p.capGroupId] : [])),
  );
  const plans = allPlans.filter(
    (p) => !p.capGroupId || (capUsage.get(p.capGroupId)?.remaining ?? 1) > 0,
  );

  const studioIds = [...new Set(plans.map((p) => p.location?.id ?? 'none'))];
  const studios = studioIds
    .map((id) => {
      const studioPlans = plans.filter((p) => (p.location?.id ?? 'none') === id);
      const location = studioPlans[0].location;
      return {
        id,
        name: location ? shortLocationName(location.name, location.address) : 'All studios',
        createdAt: location?.createdAt.getTime() ?? 0,
        plans: studioPlans.map((p) => {
          const usage = p.capGroupId ? capUsage.get(p.capGroupId) : null;
          return {
            id: p.id,
            label: p.name,
            price: `${formatDollarsShort(p.price)} / ${shortPeriodLabel(p.billingIntervalDays)}`,
            subhead: [
              shelfLine(p.shelfType),
              ticketsLine(p.classTicketsPerPeriod),
              ...(usage ? [`Founding rate · ${usage.remaining} of ${usage.cap} left`] : []),
            ],
          };
        }),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  // Joining fee and which terms waive it, worded as the design has it.
  const terms = await prisma.commitmentTerm.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const monthToMonth = terms.find((t) => t.months === null) ?? null;
  const joiningFeeCents = monthToMonth
    ? monthToMonth.joiningFeeCents
    : Math.max(0, ...plans.map((p) => p.joiningFeeCents));
  const waivingMonths = terms
    .filter((t) => t.months !== null && t.joiningFeeCents === 0)
    .map((t) => t.months as number)
    .sort((a, b) => a - b);
  const joiningFeeLine =
    joiningFeeCents > 0
      ? `${formatDollarsShort(joiningFeeCents)} joining fee` +
        (waivingMonths.length > 0
          ? `, waived on ${waivingMonths.map((m) => `${m}`).join(' and ')}-month plans`
          : '')
      : null;
  const billsOnTheFirst = plans.some((p) => p.billingAnchorDay === 1);

  let member = false;
  if (session?.user?.id) {
    member = Boolean(
      await prisma.membership.findFirst({
        where: { userId: session.user.id, status: { in: ['ACTIVE', 'PAUSED'] } },
        select: { id: true },
      }),
    );
  }

  return (
    <>
      {/* ── Hero: photo left, what's included right ──────────────────────── */}
      <section className="md:grid md:grid-cols-2">
        <SitePhoto
          photo={MEMBERSHIP_HERO}
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-[300px] w-full md:h-full md:min-h-[640px]"
        />
        <div className="flex items-center px-6 py-10 md:px-14 md:py-16 lg:px-24">
          <div className="w-full max-w-[560px]">
            <h1 className="t-h-xl text-headline">Memberships</h1>

            <p className="t-eyebrow text-headline mt-6 text-[13px]">Every membership includes:</p>
            <ul className="mt-4 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {MEMBERSHIP_INCLUDES.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <CheckIcon className="text-sage mt-1.5 size-4 shrink-0" />
                  <span>
                    <span className="t-body-sm text-body block md:text-[17px] md:leading-7">
                      {item.text}
                    </span>
                    {item.note && (
                      <span className="text-body mt-0.5 block text-[14px] leading-5">
                        {item.note}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <p className="t-eyebrow text-headline mt-10 text-[13px]">Memberships do not include:</p>
            <ul className="mt-4 flex flex-col gap-4">
              {MEMBERSHIP_EXCLUDES.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="text-rust mt-1.5 size-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  <span>
                    <span className="t-body-sm text-body block md:text-[17px] md:leading-7">
                      {item.text}
                    </span>
                    {item.note && (
                      <span className="text-body mt-0.5 block text-[14px] leading-5">
                        {item.note}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Choose a membership ───────────────────────────────────────────── */}
      <section className="border-fill border-t px-6 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1120px] text-center">
          <h2 className="t-h-xl text-headline">Choose a membership</h2>
          {joiningFeeLine && (
            <p className="t-body-sm text-body mt-4 md:text-[17px]">{joiningFeeLine}</p>
          )}
          {billsOnTheFirst && (
            <p className="text-body mt-2 text-[14px] leading-5">
              * Memberships bill on the 1st of the month.
            </p>
          )}
        </div>

        <div className="mt-10">
          {studios.length === 0 ? (
            <p className="t-body-sm text-body text-center">
              No membership plans are on sale right now.
            </p>
          ) : member ? (
            <div className="text-center">
              <p className="t-body-sm text-body">You already have a membership.</p>
              <NextLink
                href="/membership/manage"
                className="t-body-sm-bold text-headline hover:text-sage mt-3 inline-block underline underline-offset-4 transition-colors"
              >
                Manage my membership
              </NextLink>
            </div>
          ) : (
            <MembershipPlans studios={studios} />
          )}
        </div>
      </section>

      {/* ── Clay and glaze firing pricing ─────────────────────────────────── */}
      <section className="bg-cream px-6 py-14 md:px-10 md:py-20">
        <div className="border-sage-stroke mx-auto max-w-[900px] rounded-[28px] border bg-white px-6 py-10 md:px-14 md:py-12">
          <h2 className="t-h-xl text-headline text-center">{CLAY_PRICING.heading}</h2>

          <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-16">
            <PriceColumn
              eyebrow={CLAY_PRICING.clay.eyebrow}
              note={CLAY_PRICING.clay.note}
              items={CLAY_PRICING.clay.items}
              round
            />
            <PriceColumn
              eyebrow={CLAY_PRICING.firing.eyebrow}
              note={CLAY_PRICING.firing.note}
              items={CLAY_PRICING.firing.items}
            />
          </div>
        </div>
      </section>

      {/* ── Reviews ───────────────────────────────────────────────────────── */}
      <ReviewsSection className="pt-16 md:pt-24" />

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-20 md:px-10 md:pt-24 md:pb-24">
        <div className="mx-auto max-w-[760px]">
          <SitePhoto
            photo={{ src: '/site/illo-pot-faq.svg', alt: 'A pottery character holding a list' }}
            fit="contain"
            sizes="200px"
            className="mx-auto h-[150px] w-[160px]"
          />
          <h2 className="t-h-xl text-headline mt-4 mb-6 text-center">FAQ’s</h2>
          <FaqList faqs={MEMBERSHIP_FAQS} />
        </div>
      </section>
    </>
  );
}

function PriceColumn({
  eyebrow,
  note,
  items,
  round = false,
}: {
  eyebrow: string;
  note: string;
  items: PricedItem[];
  round?: boolean;
}) {
  return (
    <div>
      <p className="t-eyebrow text-headline text-center text-[13px]">{eyebrow}</p>
      <p className="text-body mt-1 text-center text-[14px] leading-5">{note}</p>
      <ul className="mt-6 flex flex-col gap-6 md:mt-8 md:gap-8">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-5">
            <SitePhoto
              photo={item.photo}
              fit={round ? 'cover' : 'contain'}
              sizes="100px"
              className={
                round ? 'bg-fill size-[88px] shrink-0 rounded-full' : 'size-[100px] shrink-0'
              }
            />
            <div>
              <p className="t-body-sm-bold text-headline">{item.name}</p>
              <p className="t-body-sm text-body">{item.price}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
