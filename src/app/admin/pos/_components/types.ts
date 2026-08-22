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

export interface PosCatalog {
  retailProducts: RetailProductCatalogItem[];
  sessionTypes: SessionTypeCatalogItem[];
  membershipPlans: MembershipPlanCatalogItem[];
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
