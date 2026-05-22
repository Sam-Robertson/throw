"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({})) as {
      error?: string;
      refundNote?: string;
    };
    if (res.ok) {
      if (data.refundNote) alert(data.refundNote);
      router.refresh();
    } else {
      alert(data.error ?? "Could not cancel booking");
    }
    setLoading(false);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={loading}
      onClick={handleCancel}
      className="text-destructive hover:text-destructive"
    >
      {loading ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
