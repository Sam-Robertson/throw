'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/site/BottomSheet';
import { Button } from '@/components/site/Button';

/**
 * Not in the design files, but an account has to be deletable: a quiet link
 * at the foot of the page that opens a confirmation sheet.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <section className="mt-14">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-rust text-sm font-bold underline underline-offset-4"
      >
        Delete my account
      </button>

      <BottomSheet
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        title="Delete your account?"
      >
        <p className="t-body-sm text-body">
          This permanently deletes your account and everything in it. Any active membership is cancelled. It
          cannot be undone.
        </p>
        {error && <p className="mt-3 text-sm text-[#ff2d55]">{error}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <Button block className="bg-rust hover:bg-rust/90" onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting…' : 'Yes, delete my account'}
          </Button>
          <Button block variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
            Keep my account
          </Button>
        </div>
      </BottomSheet>
    </section>
  );
}
