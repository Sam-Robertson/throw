'use client';

import { useState } from 'react';
import type { FiringPieceInput } from '@/lib/firing';
import { cn } from '@/lib/utils';
import { PiecesFiringTab } from './catalog/PiecesFiringTab';
import { ClassesTab } from './catalog/ClassesTab';
import { RetailTab } from './catalog/RetailTab';
import { MembershipTab } from './catalog/MembershipTab';
import { GiftCardTab } from './catalog/GiftCardTab';
import { CustomTab } from './catalog/CustomTab';
import type {
  CourseCatalogItem,
  CustomerSummary,
  PosCatalog,
  PosOrder,
  ProductCatalogItem,
} from './types';

// Ordered by how often each is used at the desk: a group paying for the pieces
// they made, then a member paying for firing, come first. Memberships is a
// lookup only (sold online until the billing migration); the server still
// accepts MEMBERSHIP items for older clients.
type TabId = 'PIECES' | 'CLASSES' | 'RETAIL' | 'MEMBERSHIP' | 'GIFT_CARD' | 'CUSTOM';

const TABS: { id: TabId; label: string }[] = [
  { id: 'PIECES', label: 'Pieces & Firing' },
  { id: 'CLASSES', label: 'Classes' },
  { id: 'RETAIL', label: 'Retail' },
  { id: 'MEMBERSHIP', label: 'Memberships' },
  { id: 'GIFT_CARD', label: 'Gift Card' },
  { id: 'CUSTOM', label: 'Custom' },
];

/** Tabs that list things from the studio's catalog. */
const CATALOG_TABS: TabId[] = ['PIECES', 'CLASSES', 'RETAIL'];

interface CatalogPanelProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  /** The attached customer's summary (membership, today's bookings, firing eligibility). */
  customerSummary: CustomerSummary | null;
  customerSummaryLoading: boolean;
  customerSummaryError: string | null;
  /** One tap adds one; a product already on the order gets its quantity raised. */
  onAddProduct: (product: ProductCatalogItem) => void;
  onAddByWeight: (productId: string, weightLb: number) => Promise<boolean>;
  onAddFiring: (pieces: FiringPieceInput[]) => Promise<boolean>;
  onAddDropIn: (studioSessionId: string) => void;
  onAddCourse: (course: CourseCatalogItem) => void;
  onAddDistinct: (payload: {
    itemType: 'GIFT_CARD' | 'CUSTOM';
    name?: string;
    unitPriceCents: number;
    metadata?: Record<string, unknown>;
  }) => void;
}

export function CatalogPanel({
  catalog,
  order,
  busy,
  customerSummary,
  customerSummaryLoading,
  customerSummaryError,
  onAddProduct,
  onAddByWeight,
  onAddFiring,
  onAddDropIn,
  onAddCourse,
  onAddDistinct,
}: CatalogPanelProps) {
  const [tab, setTab] = useState<TabId>('PIECES');

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-11 rounded-t-md px-2.5 py-2 text-sm font-medium transition-colors xl:px-4',
              tab === t.id
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* The catalog belongs to the studio, so it reloads when the studio changes. */}
      {!catalog && CATALOG_TABS.includes(tab) && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading the catalog…</p>
      )}

      {/* Each tab mounts when it becomes active, which is what focuses its search box. */}
      {catalog && tab === 'PIECES' && (
        <PiecesFiringTab
          catalog={catalog}
          order={order}
          busy={busy}
          summary={customerSummary}
          summaryLoading={customerSummaryLoading}
          onAddProduct={onAddProduct}
          onAddByWeight={onAddByWeight}
          onAddFiring={onAddFiring}
        />
      )}

      {catalog && tab === 'CLASSES' && (
        <ClassesTab
          catalog={catalog}
          order={order}
          busy={busy}
          onAddDropIn={onAddDropIn}
          onAddCourse={onAddCourse}
        />
      )}

      {catalog && tab === 'RETAIL' && (
        <RetailTab
          catalog={catalog}
          order={order}
          busy={busy}
          onAddProduct={onAddProduct}
          onAddByWeight={onAddByWeight}
        />
      )}

      {tab === 'MEMBERSHIP' && (
        <MembershipTab
          order={order}
          summary={customerSummary}
          summaryLoading={customerSummaryLoading}
          summaryError={customerSummaryError}
        />
      )}

      {tab === 'GIFT_CARD' && <GiftCardTab disabled={busy || !order} onAdd={onAddDistinct} />}

      {tab === 'CUSTOM' && <CustomTab disabled={busy || !order} onAdd={onAddDistinct} />}
    </div>
  );
}
