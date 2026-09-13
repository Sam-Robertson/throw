export interface PosOrderItem {
  id: string;
  orderId: string;
  itemType: string;
  refId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  taxCents: number;
  taxCode: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface PosPayment {
  id: string;
  orderId: string;
  method: string;
  amountCents: number;
  status: string;
  stripePaymentIntentId: string | null;
  giftCardId: string | null;
  cashTenderedCents: number | null;
  cashChangeCents: number | null;
  externalRef: string | null;
  createdAt: string;
}

export interface PosOrder {
  id: string;
  orderNumber: number;
  locationId: string;
  customerId: string | null;
  staffId: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  stripeTaxCalculationId?: string | null;
  note: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: PosOrderItem[];
  payments: PosPayment[];
  customer?: { id: string; name: string | null; email: string } | null;
  staff?: { id: string; name: string | null; email: string };
  /** Present on item-change responses; non-null when tax fell back to zero. */
  taxWarning?: string | null;
}

export interface RetailProductCatalogItem {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
}

export interface SessionTypeCatalogItem {
  id: string;
  name: string;
  dropInPriceCents: number;
}

export interface MembershipPlanCatalogItem {
  id: string;
  name: string;
  priceInCents: number;
  billingIntervalDays: number;
}

/** A bookable session at the order's studio, today through the next 6 days. */
export interface UpcomingSessionCatalogItem {
  id: string;
  startsAt: string;
  endsAt: string;
  sessionTypeId: string;
  name: string;
  dropInPriceCents: number;
  instructorName: string | null;
  capacity: number;
  confirmedCount: number;
}

export interface PosCatalog {
  retailProducts: RetailProductCatalogItem[];
  sessionTypes: SessionTypeCatalogItem[];
  membershipPlans: MembershipPlanCatalogItem[];
  upcomingSessions: UpcomingSessionCatalogItem[];
}

export interface Location {
  id: string;
  name: string;
  isActive: boolean;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function remainingBalanceCents(order: Pick<PosOrder, 'totalCents' | 'payments'>): number {
  const succeeded = order.payments
    .filter((p) => p.status === 'SUCCEEDED')
    .reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(0, order.totalCents - succeeded);
}

/** POS routes return `{ error }` codes, plus a human `message` for the ones staff can act on. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
}

export function apiErrorMessage(data: ApiErrorBody, fallback: string): string {
  return data.message ?? data.error ?? fallback;
}

function metadataRecord(item: PosOrderItem): Record<string, unknown> {
  const m = item.metadata;
  return typeof m === 'object' && m !== null && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

/** The session a drop-in line books, if any. */
export function dropInSessionIdOf(item: PosOrderItem): string | null {
  const id = metadataRecord(item).studioSessionId;
  return typeof id === 'string' ? id : null;
}

/** Drop-ins (one seat) and clay & firing lines (priced for a weight) can't change quantity. */
export function isQuantityLocked(item: PosOrderItem): boolean {
  return item.itemType === 'DROP_IN' || metadataRecord(item).kind === 'FIRING';
}

export function orderHasDropIn(order: Pick<PosOrder, 'items'> | null): boolean {
  return !!order?.items.some((i) => i.itemType === 'DROP_IN');
}

/** Codes issued for gift card lines, stored on the line when the order completes. */
export function giftCardCodesFromOrder(
  order: Pick<PosOrder, 'items'>,
): { itemId: string; amountCents: number; codes: string[] }[] {
  return order.items
    .filter((i) => i.itemType === 'GIFT_CARD')
    .map((i) => {
      const raw = metadataRecord(i).giftCardCodes;
      const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
      return { itemId: i.id, amountCents: i.unitPriceCents, codes };
    })
    .filter((g) => g.codes.length > 0);
}
