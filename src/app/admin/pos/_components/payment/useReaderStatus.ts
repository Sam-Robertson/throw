'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Live status of a studio's card readers, shared by the order panel (always
 * visible) and the tender sheet (so Card reader is never offered while the
 * reader is offline).
 *
 * One store per studio at module level: however many components subscribe,
 * there is a single gentle poll (every 30s, and whenever the tab regains
 * focus). The chosen reader is remembered per device and studio in
 * localStorage.
 */

export type Reader = {
  id: string;
  label: string;
  deviceType: string;
  status: string;
  busy: boolean;
};

export interface ReaderStatusState {
  /** null until the first check finishes. */
  readers: Reader[] | null;
  checking: boolean;
  /** Why the readers could not be listed (studio not linked, network, …). */
  error: string | null;
  readerId: string;
}

const POLL_MS = 30_000;
const LEGACY_READER_KEY = 'pos.lastReaderId';
const readerKey = (locationId: string) => `pos.reader.${locationId}`;

const EMPTY: ReaderStatusState = { readers: null, checking: false, error: null, readerId: '' };

function readRemembered(locationId: string): string {
  try {
    return (
      window.localStorage.getItem(readerKey(locationId)) ??
      window.localStorage.getItem(LEGACY_READER_KEY) ??
      ''
    );
  } catch {
    return '';
  }
}

function remember(locationId: string, readerId: string) {
  try {
    window.localStorage.setItem(readerKey(locationId), readerId);
  } catch {
    // Private mode or blocked storage: the choice just won't survive a reload.
  }
}

class ReaderStore {
  state: ReaderStatusState = EMPTY;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(private locationId: string) {}

  private set(next: Partial<ReaderStatusState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  }

  private onFocus = () => {
    if (document.visibilityState === 'visible') void this.refresh();
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), POLL_MS);
      window.addEventListener('focus', this.onFocus);
      document.addEventListener('visibilitychange', this.onFocus);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        window.removeEventListener('focus', this.onFocus);
        document.removeEventListener('visibilitychange', this.onFocus);
      }
    };
  };

  getSnapshot = () => this.state;

  refresh = (): Promise<void> => {
    if (this.inFlight) return this.inFlight;
    this.set({ checking: true });
    this.inFlight = (async () => {
      try {
        const res = await fetch(`/api/pos/readers?locationId=${this.locationId}`);
        const data = (await res.json().catch(() => ({}))) as {
          readers?: Reader[];
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          this.set({
            readers: [],
            checking: false,
            error: data.message ?? data.error ?? 'Could not check the card reader.',
          });
          return;
        }
        const readers = data.readers ?? [];
        this.set({ readers, checking: false, error: null, readerId: this.pick(readers) });
      } catch {
        this.set({ readers: [], checking: false, error: 'Could not check the card reader. Is this device online?' });
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  };

  /** Keep the remembered reader while it is registered; otherwise the first online one. */
  private pick(readers: Reader[]): string {
    const wanted = this.state.readerId || readRemembered(this.locationId);
    if (wanted && readers.some((r) => r.id === wanted)) return wanted;
    return (readers.find((r) => r.status === 'online') ?? readers[0])?.id ?? '';
  }

  choose = (readerId: string) => {
    remember(this.locationId, readerId);
    this.set({ readerId });
  };
}

const stores = new Map<string, ReaderStore>();

function storeFor(locationId: string): ReaderStore {
  let store = stores.get(locationId);
  if (!store) {
    store = new ReaderStore(locationId);
    stores.set(locationId, store);
  }
  return store;
}

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY;

export interface ReaderStatus extends ReaderStatusState {
  /** The reader payments will be sent to, if any is registered. */
  selected: Reader | null;
  /** True when the selected reader is online and can take a payment now. */
  ready: boolean;
  /** Staff-facing reason the reader can't be used; null when ready or still checking. */
  reason: string | null;
  refresh: () => Promise<void>;
  chooseReader: (readerId: string) => void;
}

export function useReaderStatus(locationId: string | null | undefined): ReaderStatus {
  const store = locationId ? storeFor(locationId) : null;
  const state = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : emptySnapshot,
    emptySnapshot,
  );

  // Remember a reader the first time one is picked for this studio, so the
  // register keeps using it even when another comes online first tomorrow.
  useEffect(() => {
    if (locationId && state.readerId && !readRemembered(locationId)) remember(locationId, state.readerId);
  }, [locationId, state.readerId]);

  const refresh = useCallback(() => (store ? store.refresh() : Promise.resolve()), [store]);
  const chooseReader = useCallback((id: string) => store?.choose(id), [store]);

  const selected = state.readers?.find((r) => r.id === state.readerId) ?? null;
  const ready = selected?.status === 'online';

  let reason: string | null = null;
  if (state.readers !== null && !ready) {
    if (state.error) reason = state.error;
    else if (state.readers.length === 0) {
      reason = 'No card reader is registered to this studio. Add one in Studio setup → Card readers.';
    } else {
      reason = `${selected?.label ?? 'The reader'} is offline. Check that it is on and connected to Wi-Fi.`;
    }
  }

  return { ...state, selected, ready, reason, refresh, chooseReader };
}
