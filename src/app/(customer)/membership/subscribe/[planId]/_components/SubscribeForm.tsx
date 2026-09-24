"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface TermOption {
  id: string;
  name: string;
  months: number | null;
  joiningFeeCents: number;
  retailDiscountPercent: number;
  includesGuestPass: boolean;
  includesVideoLibrary: boolean;
  freeMonths: number;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** What a term gives, straight from its data. */
function termPerks(term: TermOption, firstTimeMember: boolean): string[] {
  const perks: string[] = [];
  if (firstTimeMember) {
    perks.push(
      term.joiningFeeCents > 0
        ? `${formatDollars(term.joiningFeeCents)} one-time joining fee`
        : "Joining fee waived",
    );
  }
  if (term.retailDiscountPercent > 0) perks.push(`${term.retailDiscountPercent}% off retail`);
  if (term.includesGuestPass) perks.push("Guest pass included");
  if (term.includesVideoLibrary) perks.push("Video library");
  if (term.freeMonths > 0)
    perks.push(`${term.freeMonths} month${term.freeMonths === 1 ? "" : "s"} free`);
  return perks;
}

export function SubscribeForm({
  planId,
  terms,
  firstTimeMember,
}: {
  planId: string;
  terms: TermOption[];
  /** The joining fee is only charged to someone who has never held a membership. */
  firstTimeMember: boolean;
}) {
  const [termId, setTermId] = useState<string | null>(terms[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiverHref, setWaiverHref] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, commitmentTermId: termId }),
    });
    if (res.ok) {
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } else {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        waiverVersionId?: string;
      };
      setError(data.error ?? "Something went wrong. Please try again.");
      setWaiverHref(
        data.code === "WAIVER_REQUIRED" && data.waiverVersionId
          ? `/waiver?${new URLSearchParams({
              versionId: data.waiverVersionId,
              callbackUrl: `/membership/subscribe/${planId}`,
            })}`
          : null,
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {terms.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Choose your commitment</legend>
          {terms.map((term) => {
            const perks = termPerks(term, firstTimeMember);
            return (
              <label
                key={term.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                  termId === term.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="commitmentTerm"
                  className="mt-1"
                  checked={termId === term.id}
                  onChange={() => setTermId(term.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{term.name}</span>
                  {perks.length > 0 && (
                    <span className="block text-xs text-muted-foreground">{perks.join(" · ")}</span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {error}
          {waiverHref && (
            <>
              {" "}
              <a href={waiverHref} className="font-medium underline underline-offset-4">
                Sign it now
              </a>
            </>
          )}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={loading} onClick={handleSubscribe}>
        {loading ? "Redirecting..." : "Start Membership"}
      </Button>
    </div>
  );
}
