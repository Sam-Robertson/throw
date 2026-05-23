"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

interface Props {
  otherPlans: Plan[];
}

export function PlanSwitcher({ otherPlans }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (otherPlans.length === 0) return null;

  async function handleSwitch(newPlanId: string) {
    setLoadingId(newPlanId);
    try {
      const res = await fetch("/api/memberships/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlanId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to change plan");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Switch Plan
      </h2>
      <ul className="space-y-3">
        {otherPlans.map((plan) => (
          <li
            key={plan.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">{plan.name}</p>
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
              <p className="mt-1 text-sm font-semibold">
                ${(plan.price / 100).toFixed(2)} / period
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingId !== null}
              onClick={() => handleSwitch(plan.id)}
            >
              {loadingId === plan.id ? "Switching…" : "Switch to this plan"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
