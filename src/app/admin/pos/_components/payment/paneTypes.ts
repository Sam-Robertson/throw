import type { PosOrder } from '../types';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** What every tender pane gets from the payment sheet. */
export interface PaneProps {
  orderId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  /** `note` is a one-line summary for the tender sheet, e.g. what a gift card has left. */
  onResult: (order: PosOrder, note?: string) => void;
}
