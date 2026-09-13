'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  CLAY_BAG_SIZES_LB,
  FIRING_TIERS,
  quoteFiring,
  type FiringTier,
} from '@/config/firingPrices';
import { formatMoney, type PosOrder } from './types';

interface PieceOption {
  id: string;
  description: string;
  pieceCount: number;
  groupName: string | null;
  createdAt: string;
}

/**
 * /api/admin/pieces is built by the piece-intake workstream; accept either a
 * bare array or `{ pieces: [...] }`, and keep only INTAKE rows.
 */
function parsePieces(data: unknown): PieceOption[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { pieces?: unknown }).pieces)
      ? ((data as { pieces: unknown[] }).pieces)
      : [];

  return list.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string') return [];
    if (typeof r.status === 'string' && r.status !== 'INTAKE') return [];
    return [
      {
        id: r.id,
        description: typeof r.description === 'string' ? r.description : '',
        pieceCount: typeof r.pieceCount === 'number' ? r.pieceCount : 1,
        groupName: typeof r.groupName === 'string' ? r.groupName : null,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
      },
    ];
  });
}

interface FiringPanelProps {
  order: PosOrder | null;
  busy: boolean;
  onAdd: (payload: {
    itemType: 'CUSTOM';
    name: string;
    unitPriceCents: number;
    metadata: Record<string, unknown>;
  }) => void;
}

export function FiringPanel({ order, busy, onAdd }: FiringPanelProps) {
  const [tier, setTier] = useState<FiringTier>('MEMBER_SMALL');
  const [lb, setLb] = useState('');
  const [oz, setOz] = useState('');
  const [count, setCount] = useState('1');
  const [bagLb, setBagLb] = useState<number>(CLAY_BAG_SIZES_LB[0]);

  const [pieces, setPieces] = useState<PieceOption[]>([]);
  const [piecesError, setPiecesError] = useState<string | null>(null);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);

  const customerId = order?.customerId ?? null;
  const isClay = tier === 'CLAY';

  // Offer the customer's un-fired pieces so the charge can be recorded on them.
  useEffect(() => {
    setSelectedPieceIds([]);
    setPieces([]);
    setPiecesError(null);
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/admin/pieces?userId=${encodeURIComponent(customerId)}&status=INTAKE`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!cancelled) setPieces(parsePieces(data));
      })
      .catch(() => {
        if (!cancelled) setPiecesError("Couldn't load this customer's pieces.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const weightOz = isClay
    ? bagLb * 16
    : (parseInt(lb || '0', 10) || 0) * 16 + (parseInt(oz || '0', 10) || 0);
  const countNum = parseInt(count || '0', 10) || 0;

  const quote = useMemo(
    () => quoteFiring({ tier, weightOz, count: countNum }),
    [tier, weightOz, countNum],
  );

  const tierMeta = FIRING_TIERS.find((t) => t.id === tier)!;
  const hasInput = isClay || lb !== '' || oz !== '';

  function togglePiece(id: string) {
    setSelectedPieceIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function submit() {
    if (!quote.ok) return;
    onAdd({
      itemType: 'CUSTOM',
      name: quote.name,
      unitPriceCents: quote.totalCents,
      metadata: {
        kind: 'FIRING',
        tier,
        weightOz,
        count: countNum,
        ...(!isClay && selectedPieceIds.length > 0 ? { pieceIds: selectedPieceIds } : {}),
      },
    });
    setLb('');
    setOz('');
    setCount('1');
    setSelectedPieceIds([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FIRING_TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTier(t.id)}
            className={cn(
              'min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
              tier === t.id ? 'border-foreground bg-muted' : 'hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isClay ? (
        <div>
          <Label className="text-sm font-medium">{tierMeta.weightLabel}</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {CLAY_BAG_SIZES_LB.map((size) => (
              <Button
                key={size}
                variant={bagLb === size ? 'default' : 'outline'}
                className="min-h-11 flex-1"
                onClick={() => setBagLb(size)}
              >
                {size} lb
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Label className="text-sm font-medium">{tierMeta.weightLabel}</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="0"
                value={lb}
                onChange={(e) => setLb(e.target.value.replace(/\D/g, ''))}
                className="min-h-11 text-base"
                aria-label="Pounds"
              />
              <span className="text-sm text-muted-foreground">lb</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="0"
                value={oz}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setOz(digits === '' ? '' : String(Math.min(15, parseInt(digits, 10))));
                }}
                className="min-h-11 text-base"
                aria-label="Ounces"
              />
              <span className="text-sm text-muted-foreground">oz</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-medium">{isClay ? 'Bags' : 'Pieces'}</Label>
        <Input
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
          className="mt-1 min-h-11 w-28 text-base"
        />
      </div>

      {!isClay && customerId && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">Record on the customer&apos;s pieces (optional)</p>
          {piecesError ? (
            <p className="mt-1 text-sm text-muted-foreground">{piecesError}</p>
          ) : pieces.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No logged pieces waiting to be fired.</p>
          ) : (
            <div className="mt-2 divide-y">
              {pieces.map((p) => (
                <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={selectedPieceIds.includes(p.id)}
                    onChange={() => togglePiece(p.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {p.groupName ? `${p.groupName}: ` : ''}
                      {p.pieceCount} piece{p.pieceCount === 1 ? '' : 's'}
                    </span>
                    {p.description && (
                      <span className="block truncate text-muted-foreground">{p.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-3">
        {!hasInput ? (
          <p className="text-sm text-muted-foreground">Enter a weight to see the price.</p>
        ) : quote.ok ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{quote.name}</span>
            <span className="text-lg font-semibold">{formatMoney(quote.totalCents)}</span>
          </div>
        ) : (
          <p className="text-sm text-amber-900">{quote.reason}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Provisional prices from the website and Momence. Still to be confirmed by JP.
      </p>

      <Button className="min-h-11" disabled={busy || !order || !quote.ok} onClick={submit}>
        Add to cart
      </Button>
    </div>
  );
}
