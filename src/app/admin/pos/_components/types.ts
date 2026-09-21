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
  note: string | null;
  /** Product category on RETAIL lines (PIECES, FIRING, …); null on other lines. */
  category: string | null;
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

/** A named discount on an order. `amountCents` is recomputed on every reprice. */
export interface PosOrderDiscount {
  id: string;
  orderId: string;
  discountCodeId: string | null;
  name: string;
  amountCents: number;
  /** Automatic member discounts attach and detach with the customer. */
  automatic: boolean;
  note: string | null;
  discountCode: {
    id: string;
    code: string;
    type: 'percent' | 'fixed_cents';
    value: number;
    scope: string;
    appliesVia: string;
  } | null;
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
  walkInName: string | null;
  walkInPhone: string | null;
  /** Set while the order is parked for a customer who stepped away. */
  parkedAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: PosOrderItem[];
  payments: PosPayment[];
  discounts: PosOrderDiscount[];
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

export type ProductCategory = 'RETAIL' | 'PIECES' | 'FIRING' | 'CLAY' | 'CLASS_PACK' | 'SHIPPING';

/** Any sellable product. `priceCents` is per pound when `unit` is LB. */
export interface ProductCatalogItem {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: ProductCategory;
  unit: 'EACH' | 'LB';
  priceCents: number;
  minChargeCents: number | null;
  membersOnly: boolean;
  trackInventory: boolean;
  /** null when stock isn't tracked. */
  stock: number | null;
  classCredits: number | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface ProductGroup {
  category: ProductCategory;
  label: string;
  products: ProductCatalogItem[];
}

/** A discount staff can apply by hand at this studio. */
export interface StaffDiscount {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  type: 'percent' | 'fixed_cents';
  value: number;
  scope: string;
  sessionTypeName: string | null;
  productSlug: string | null;
  maxUnits: number | null;
  maxUsesPerCustomerPerYear: number | null;
  requiresNote: boolean;
  requiresGroupEvent: boolean;
  requiresCustomer: boolean;
}

export interface FiringRates {
  standardCentsPerLb: number;
  oversizeCentsPerLb: number;
  minChargeCents: number;
  standardProductId: string;
  oversizeProductId: string;
}

/** GET /api/pos/customers/[id]/summary */
export interface CustomerSummary {
  customer: { id: string; name: string | null; email: string; phone: string | null };
  membership: {
    id: string;
    planId: string;
    planName: string;
    tier: string | null;
    status: 'ACTIVE' | 'PAUSED';
    currentPeriodEnd: string;
    commitmentMonths: number | null;
  } | null;
  tickets: { remaining: number | null; unlimited: boolean } | null;
  accountCreditCents: number;
  giftCards: { id: string; code: string; balanceCents: number }[];
  giftCardBalanceCents: number;
  classPackCredits: number;
  todaysBookings: {
    id: string;
    status: string;
    quantity: number;
    studioSessionId: string;
    name: string;
    kind: string;
    startsAt: string;
    endsAt: string;
  }[];
  waiverOnFile: boolean;
  canUseMemberFiring: boolean;
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
  /** "EVENT" | "COURSE". Course sessions sharing a seriesId are one course. */
  kind: string;
  seriesId: string | null;
}

export interface PosCatalog {
  retailProducts: RetailProductCatalogItem[];
  sessionTypes: SessionTypeCatalogItem[];
  membershipPlans: MembershipPlanCatalogItem[];
  upcomingSessions: UpcomingSessionCatalogItem[];
  products: ProductCatalogItem[];
  productGroups: ProductGroup[];
  staffDiscounts: StaffDiscount[];
  groupEventSessions: { id: string; name: string; startsAt: string }[];
  firingRates: FiringRates | null;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
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
