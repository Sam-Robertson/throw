"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant } from "@/components/site/Button";

const ENDPOINTS = {
  resume: "/api/memberships/resume",
  "undo-cancel": "/api/memberships/cancel/undo",
} as const;

/** "Restart membership" / "Keep my membership": one POST, then the page reloads its data. */
export function MembershipAction({
  action,
  variant = "primary",
  className,
  children,
}: {
  action: keyof typeof ENDPOINTS;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(ENDPOINTS[action], { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className={className}>
      <Button block variant={variant} onClick={run} disabled={loading}>
        {loading ? "One moment…" : children}
      </Button>
      {error && <p className="mt-3 text-center text-sm text-[#ff2d55]">{error}</p>}
    </div>
  );
}
