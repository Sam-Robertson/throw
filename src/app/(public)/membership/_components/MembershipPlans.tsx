'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/site/Button';
import { OptionCardGroup, type Option } from '@/components/site/OptionCard';
import { cn } from '@/lib/utils';

interface Studio {
  id: string;
  name: string;
  plans: Option[];
}

/**
 * "Choose a membership" on the public page: the plans as option cards, three
 * across on desktop, with a Start a membership button underneath. Studios
 * with their own plans get a tab row above the cards. Starting goes to that
 * plan's checkout, which asks for a sign-in first if needed.
 */
export function MembershipPlans({ studios }: { studios: Studio[] }) {
  const router = useRouter();
  const [studioId, setStudioId] = useState(studios[0]?.id ?? '');
  const studio = studios.find((s) => s.id === studioId) ?? studios[0];
  // The design draws the middle plan selected by default.
  const [planId, setPlanId] = useState<string>(studio?.plans[1]?.id ?? studio?.plans[0]?.id ?? '');
  const [going, setGoing] = useState(false);

  if (!studio) return null;

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      {studios.length > 1 && (
        <div role="tablist" aria-label="Studio" className="mb-6 flex justify-center gap-2">
          {studios.map((s) => {
            const on = s.id === studio.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStudioId(s.id);
                  setPlanId(s.plans[1]?.id ?? s.plans[0]?.id ?? '');
                }}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-bold transition-colors',
                  on
                    ? 'border-sage bg-sage text-white'
                    : 'border-sage-stroke text-headline bg-white',
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      <OptionCardGroup
        name="plan"
        options={studio.plans}
        value={planId}
        onChange={setPlanId}
        className="md:grid md:grid-cols-3 md:items-start md:gap-5 [&>label]:md:min-h-[150px] [&>label]:md:px-5 [&>label]:md:py-5"
      />

      <div className="mt-8 flex justify-center">
        <Button
          block
          disabled={!planId || going}
          className="md:w-auto md:px-14"
          onClick={() => {
            setGoing(true);
            router.push(`/membership/subscribe/${planId}`);
          }}
        >
          {going ? 'One moment…' : 'Start a membership'}
        </Button>
      </div>
    </div>
  );
}
