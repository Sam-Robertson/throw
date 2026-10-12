"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/site/Button";

export function CancelConfirmButton({ reason, disabled }: { reason: string; disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/memberships/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      router.push("/membership/manage");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Something went wrong. Please try again.");
    setLoading(false);
  }

  return (
    <div className="sticky bottom-0 mt-auto bg-white pt-8 pb-4">
      {error && <p className="mb-3 text-center text-sm text-[#ff2d55]">{error}</p>}
      <Button block disabled={disabled || loading} onClick={cancel}>
        {loading ? "Cancelling…" : "Cancel my membership"}
      </Button>
    </div>
  );
}
