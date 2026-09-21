'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ReaderStatus } from '../payment/useReaderStatus';

/**
 * Always-visible card reader status in the order panel, so staff know the
 * reader is offline before they tap Charge, not after.
 */
export function ReaderStatusBar({ status }: { status: ReaderStatus }) {
  const [choosing, setChoosing] = useState(false);
  const { readers, selected, ready, reason, checking } = status;

  if (readers === null) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
        Checking the card reader…
      </div>
    );
  }

  const others = readers.filter((r) => r.id !== selected?.id);

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        ready ? 'bg-card' : 'border-destructive/40 bg-destructive/10'
      }`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-2.5 shrink-0 rounded-full ${ready ? 'bg-green-600' : 'bg-destructive'}`}
        />
        <div className="min-w-0 flex-1">
          {ready ? (
            <p className="truncate">
              <span className="font-medium">Reader connected</span>
              <span className="text-muted-foreground">
                {' '}
                · {selected!.label}
                {selected!.busy ? ' · in use' : ''}
              </span>
            </p>
          ) : (
            <p className="font-semibold text-destructive">No reader connected</p>
          )}
        </div>
        {others.length > 0 && (
          <Button
            variant="ghost"
            className="min-h-11 shrink-0 px-2"
            onClick={() => setChoosing((v) => !v)}
          >
            {choosing ? 'Done' : 'Change'}
          </Button>
        )}
        <Button
          variant={ready ? 'ghost' : 'outline'}
          className="min-h-11 shrink-0 px-3"
          onClick={() => void status.refresh()}
          disabled={checking}
        >
          {checking ? 'Checking…' : ready ? 'Refresh' : 'Reconnect'}
        </Button>
      </div>

      {!ready && reason && <p className="mt-1 text-destructive">{reason}</p>}
      {choosing && (
        <div className="mt-2 flex flex-col gap-1.5">
          {readers.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                status.chooseReader(r.id);
                setChoosing(false);
              }}
              aria-pressed={r.id === selected?.id}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-md border bg-background px-3 text-left ${
                r.id === selected?.id ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted'
              }`}
            >
              <span className="min-w-0 truncate font-medium">{r.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.status !== 'online' ? 'Offline' : r.busy ? 'In use' : 'Ready'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
