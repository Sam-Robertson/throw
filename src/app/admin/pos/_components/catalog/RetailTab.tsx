'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { cn } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { WeightAdd } from './PiecesFiringTab';
import {
  formatMoney,
  type PosCatalog,
  type PosOrder,
  type ProductCatalogItem,
  type ProductCategory,
} from '../types';

// Shelf retail first, then the two things staff also ring up from here.
// Pieces, firing and clay have their own tab.
const RETAIL_TAB_CATEGORIES: ProductCategory[] = ['RETAIL', 'CLASS_PACK', 'SHIPPING'];

interface RetailTabProps {
  catalog: PosCatalog | null;
  order: PosOrder | null;
  busy: boolean;
  onAddProduct: (product: ProductCatalogItem) => void;
  onAddByWeight: (productId: string, weightLb: number) => Promise<boolean>;
}

export function RetailTab({ catalog, order, busy, onAddProduct, onAddByWeight }: RetailTabProps) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const groups = useMemo(
    () =>
      RETAIL_TAB_CATEGORIES.flatMap((category) => {
        const group = (catalog?.productGroups ?? []).find((g) => g.category === category);
        if (!group) return [];
        const products = group.products.filter((p) => !q || p.name.toLowerCase().includes(q));
        return products.length > 0 ? [{ ...group, products }] : [];
      }),
    [catalog, q],
  );

  const hasRetail = (catalog?.products ?? []).some((p) => p.category === 'RETAIL');

  // Why a tile can't be tapped right now, or null when it can.
  function blockedReason(p: ProductCatalogItem): string | null {
    if (p.trackInventory && (p.stock ?? 0) <= 0) return 'Out of stock';
    if (p.category === 'CLASS_PACK' && !order?.customerId) return 'Attach a customer first';
    return null;
  }

  function addTopResult() {
    if (!q || busy || !order) return;
    const top = groups.flatMap((g) => g.products).find((p) => p.unit === 'EACH' && !blockedReason(p));
    if (top) onAddProduct(top);
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={search} onChange={setSearch} onEnter={addTopResult} placeholder="Search products…" />

      {catalog && !hasRetail && !q && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No retail products yet.{' '}
          <NextLink href="/admin/studio-setup/products" className="font-medium text-foreground underline">
            Add products in Studio Set-up › Products
          </NextLink>
          .
        </p>
      )}

      {q && groups.length === 0 && <p className="text-sm text-muted-foreground">No products match.</p>}

      {groups.map((group) => (
        <section key={group.category} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{group.label}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.products
              .filter((p) => p.unit === 'EACH')
              .map((p) => {
                const blocked = blockedReason(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={blocked !== null || busy || !order}
                    onClick={() => onAddProduct(p)}
                    className={cn(
                      'min-h-24 rounded-lg border p-4 text-left transition-colors',
                      blocked ? 'cursor-not-allowed opacity-50' : 'hover:border-primary hover:bg-muted active:bg-muted',
                    )}
                  >
                    <p className="font-medium leading-tight">{p.name}</p>
                    <p className="mt-1 text-lg font-semibold">{formatMoney(p.priceCents)}</p>
                    {/* Stock only means something when it's tracked. */}
                    {(blocked || p.trackInventory) && (
                      <p className="mt-1 text-sm text-muted-foreground">{blocked ?? `${p.stock} in stock`}</p>
                    )}
                  </button>
                );
              })}
          </div>
          {group.products
            .filter((p) => p.unit === 'LB')
            .map((p) => (
              <WeightAdd key={p.id} product={p} disabled={busy || !order} onAdd={onAddByWeight} />
            ))}
        </section>
      ))}
    </div>
  );
}
