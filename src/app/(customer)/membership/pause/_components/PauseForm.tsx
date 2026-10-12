"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/site/Button";
import { Checkbox } from "@/components/site/Checkbox";

export function PauseForm({ fee, eligible }: { fee: string; eligible: boolean }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pause() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/memberships/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agree: agreed }),
    });
    if (res.ok) {
      const data = (await res.json()) as { emailed?: boolean };
      router.push(`/membership/pause/confirmed${data.emailed ? "?emailed=1" : ""}`);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Something went wrong. Please try again.");
    setLoading(false);
  }

  return (
    <>
      <Checkbox checked={agreed} onChange={setAgreed} className="mt-8">
        I agree to the terms and conditions outlined above
      </Checkbox>
      <div className="sticky bottom-0 mt-auto bg-white pt-8 pb-4">
        {error && <p className="mb-3 text-center text-sm text-[#ff2d55]">{error}</p>}
        <Button block disabled={!agreed || !eligible || loading} onClick={pause}>
          {loading ? "Pausing…" : `Pause for ${fee}`}
        </Button>
      </div>
    </>
  );
}
