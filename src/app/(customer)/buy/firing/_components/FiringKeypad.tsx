'use client';

import { useState } from 'react';
import { Button } from '@/components/site/Button';
import { Checkbox } from '@/components/site/Checkbox';
import { quoteMemberFiring, type FiringRates } from '@/lib/firing';
import { cn } from '@/lib/utils';

type Piece = { weightLb: number; oversize: boolean };

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
function rate(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;
const MAX_PIECES = 20;

/**
 * The weight keypad. The display reads like a scale ("3.0 lbs"), the line
 * under it prices the current piece with the live rate, and the saved
 * pieces are summed into the Pay button. Pay also takes whatever is on the
 * display, so a single piece needs no Add piece tap.
 */
export function FiringKeypad({ rates }: { rates: FiringRates }) {
  const [entry, setEntry] = useState(''); // what's been typed, e.g. "1.2"
  const [oversize, setOversize] = useState(false);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = entry === '' || entry === '.' ? 0 : Number(entry);
  const currentQuote =
    current > 0 ? quoteMemberFiring([{ weightLb: current, oversize }], rates) : null;
  const currentCents = currentQuote?.ok ? currentQuote.totalCents : 0;
  const savedQuote = pieces.length ? quoteMemberFiring(pieces, rates) : null;
  const savedCents = savedQuote?.ok ? savedQuote.totalCents : 0;
  const payCents = savedCents + currentCents;
  const perLb = oversize ? rates.oversizeCentsPerLb : rates.standardCentsPerLb;
  const display =
    entry === ''
      ? '0.0'
      : entry.endsWith('.')
        ? `${entry}0`
        : entry.includes('.')
          ? entry
          : `${entry}.0`;

  function press(key: (typeof KEYS)[number]) {
    setError(null);
    if (key === '⌫') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    setEntry((e) => {
      if (key === '.') return e.includes('.') ? e : e === '' ? '0.' : `${e}.`;
      if (e.includes('.')) {
        // One decimal place, like the studio scale.
        return e.split('.')[1].length >= 1 ? e : `${e}${key}`;
      }
      if (e === '0') return key;
      return e.length >= 3 ? e : `${e}${key}`;
    });
  }

  function addPiece() {
    if (!currentQuote?.ok) {
      setError(currentQuote && !currentQuote.ok ? currentQuote.reason : 'Enter a weight first.');
      return;
    }
    if (pieces.length >= MAX_PIECES) {
      setError(`Up to ${MAX_PIECES} pieces at a time.`);
      return;
    }
    setPieces((p) => [...p, { weightLb: current, oversize }]);
    setEntry('');
    setOversize(false);
    setError(null);
  }

  function removePiece(i: number) {
    setPieces((p) => p.filter((_, idx) => idx !== i));
  }

  async function pay() {
    const all = current > 0 ? [...pieces, { weightLb: current, oversize }] : pieces;
    if (all.length === 0) {
      setError('Enter a weight first.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/shop/firing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pieces: all }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? 'Could not start checkout. Please try again.');
    setBusy(false);
  }

  return (
    <>
      {pieces.length > 0 && (
        <div className="mt-4 text-center">
          <p className="t-body-sm-bold text-headline">
            {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} saved | {money(savedCents)}
          </p>
          <ul className="text-body mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[13px] leading-5">
            {pieces.map((p, i) => (
              <li key={i}>
                {p.weightLb.toFixed(1)} lb{p.oversize ? ' (over 12 in)' : ''}
                <button
                  type="button"
                  onClick={() => removePiece(i)}
                  aria-label={`Remove piece ${i + 1}`}
                  className="text-headline ml-1 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The scale read-out */}
      <div className="mt-6 text-center" aria-live="polite">
        <p className="text-headline font-serif text-[64px] leading-none">
          {display}
          <span className="t-body-sm-bold ml-1 align-baseline">lbs</span>
        </p>
        <p className="text-body mt-3 text-[13px] leading-5">
          {display} lb x {rate(perLb)} / lb = {money(currentCents)}
          {currentQuote?.ok && currentQuote.lines[0].minimumApplied && ' (minimum per piece)'}
        </p>
      </div>

      <Checkbox checked={oversize} onChange={setOversize} className="mt-5 justify-center">
        This piece is taller than 12 inches
      </Checkbox>

      <div className="mx-auto mt-6 grid w-full max-w-[300px] grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === '⌫' ? 'Delete' : k}
            className={cn(
              'bg-sage-fill text-headline flex h-14 items-center justify-center rounded-full text-[20px] font-bold transition-colors',
              'hover:bg-sage-stroke/60 active:bg-sage-stroke',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-center text-[14px] leading-5 text-[#ff2d55]">{error}</p>}

      <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-3 bg-white pt-8 pb-4">
        <Button variant="secondary" block onClick={addPiece} disabled={busy || current <= 0}>
          Add piece
        </Button>
        <Button block onClick={pay} disabled={busy || payCents <= 0}>
          {busy ? 'One moment…' : `Pay ${money(payCents)}`}
        </Button>
      </div>
    </>
  );
}
