"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMountainTime } from "@/lib/timezone";

interface Props {
  waiverVersionId: string;
  content: string;
  userName: string;
  callbackUrl: string;
}

export function WaiverSignForm({
  waiverVersionId,
  content,
  userName,
  callbackUrl,
}: Props) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = formatMountainTime(new Date(), "date");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/waivers/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiverVersionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to sign waiver");
        return;
      }
      router.push(callbackUrl);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {content}
        </pre>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <label htmlFor="agree" className="cursor-pointer text-sm leading-snug">
          I have read and agree to the terms above
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-lg border p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Signature
        </p>
        <p className="font-medium">{userName || "—"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{today}</p>
      </div>

      <Button
        type="submit"
        disabled={!agreed || submitting}
        size="lg"
        className="w-full"
      >
        {submitting ? "Signing…" : "Sign and Continue"}
      </Button>
    </form>
  );
}
