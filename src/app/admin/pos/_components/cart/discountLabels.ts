import { formatMoney } from '../types';

const SCOPE_LABELS: Record<string, string> = {
  RETAIL: 'retail',
  PIECES: 'pieces',
  CLASSES: 'classes',
  EVERYTHING: 'everything',
};

/** "20% off retail", "$10.00 off classes": what a discount does, in words staff can repeat. */
export function describeDiscount(discount: { type: string; value: number; scope: string }): string {
  const amount = discount.type === 'percent' ? `${discount.value}%` : formatMoney(discount.value);
  const scope = SCOPE_LABELS[discount.scope] ?? discount.scope.toLowerCase();
  return `${amount} off ${scope}`;
}
