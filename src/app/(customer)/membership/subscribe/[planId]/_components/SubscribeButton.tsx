"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubscribeButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    const res = await fetch("/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    if (res.ok) {
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" size="lg" disabled={loading} onClick={handleSubscribe}>
      {loading ? "Redirecting..." : "Start Membership"}
    </Button>
  );
}
