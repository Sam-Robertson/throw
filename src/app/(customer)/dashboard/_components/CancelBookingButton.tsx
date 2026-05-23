'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';

interface Props {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
    const data = await res.json().catch(() => ({})) as { error?: string; refundNote?: string };
    if (res.ok) {
      if (data.refundNote) alert(data.refundNote);
      router.refresh();
    } else {
      alert(data.error ?? 'Could not cancel booking');
    }
    setLoading(false);
  }

  return (
    <Button
      size="small"
      color="error"
      variant="text"
      disabled={loading}
      onClick={handleCancel}
      sx={{ minWidth: 0 }}
    >
      {loading ? 'Cancelling…' : 'Cancel'}
    </Button>
  );
}
