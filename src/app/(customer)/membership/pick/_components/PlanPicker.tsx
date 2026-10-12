"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/site/Button";
import { OptionCardGroup, type Option } from "@/components/site/OptionCard";
import { cn } from "@/lib/utils";

interface Studio {
  id: string;
  name: string;
  plans: Option[];
}

export function PlanPicker({ studios, initialStudioId }: { studios: Studio[]; initialStudioId: string }) {
  const router = useRouter();
  const [studioId, setStudioId] = useState(
    studios.some((s) => s.id === initialStudioId) ? initialStudioId : studios[0].id,
  );
  const [planId, setPlanId] = useState<string>("");
  const [going, setGoing] = useState(false);
  const studio = studios.find((s) => s.id === studioId) ?? studios[0];

  return (
    <>
      {studios.length > 1 && (
        <div role="tablist" aria-label="Studio" className="mt-6 flex gap-2">
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
                  setPlanId("");
                }}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-bold transition-colors",
                  on ? "border-sage bg-sage text-white" : "border-sage-stroke text-headline bg-white",
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
        className="mt-6"
      />

      <div className="sticky bottom-0 mt-auto bg-white pt-8 pb-4">
        <Button
          block
          disabled={!planId || going}
          onClick={() => {
            setGoing(true);
            router.push(`/membership/subscribe/${planId}`);
          }}
        >
          {going ? "One moment…" : "Continue"}
        </Button>
      </div>
    </>
  );
}
