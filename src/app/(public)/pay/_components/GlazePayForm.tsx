'use client';

import { useState } from 'react';
import { Button } from '@/components/site/Button';
import { Checkbox } from '@/components/site/Checkbox';
import { Field } from '@/components/site/Field';
import { quoteMemberFiring, type FiringRates } from '@/lib/firing';
import { OVERSIZE_HEIGHT_IN } from '@/lib/glazePay';
import { TEXT_CONSENT_WORDING } from '@/app/api/pieces/_shared';

type Piece = { weightLb: number; heightIn: number };

const MAX_PIECES = 20;

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
function rate(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function isOversize(p: Piece) {
  return p.heightIn > OVERSIZE_HEIGHT_IN;
}

/**
 * Name and phone, then one piece at a time: weight and height at the
 * tallest point price it (over 12 inches is the oversize rate). Add as many
 * as needed and pay for all of them by card through Stripe Checkout.
 */
export function GlazePayForm({ rates }: { rates: FiringRates }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [textOptIn, setTextOptIn] = useState(true);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; weight?: string; height?: string }>({});

  const current: Piece | null =
    weight.trim() && height.trim() ? { weightLb: Number(weight), heightIn: Number(height) } : null;
  const currentQuote =
    current && current.weightLb > 0
      ? quoteMemberFiring([{ weightLb: current.weightLb, oversize: isOversize(current) }], rates)
      : null;
  const currentCents = currentQuote?.ok ? currentQuote.totalCents : 0;
  const savedQuote = pieces.length
    ? quoteMemberFiring(
        pieces.map((p) => ({ weightLb: p.weightLb, oversize: isOversize(p) })),
        rates,
      )
    : null;
  const savedCents = savedQuote?.ok ? savedQuote.totalCents : 0;
  const payCents = savedCents + currentCents;

  function validatePiece(): Piece | null {
    const errs: typeof fieldErrors = {};
    const w = Number(weight);
    const h = Number(height);
    if (!weight.trim() || !Number.isFinite(w) || w <= 0) errs.weight = 'Enter the weight in pounds';
    if (!height.trim() || !Number.isFinite(h) || h < 0) errs.height = 'Enter the height in inches';
    setFieldErrors((e) => ({ ...e, ...errs, weight: errs.weight, height: errs.height }));
    if (errs.weight || errs.height) return null;
    return { weightLb: w, heightIn: h };
  }

  function addPiece() {
    setError(null);
    const piece = validatePiece();
    if (!piece) return;
    if (pieces.length >= MAX_PIECES) {
      setError(`Up to ${MAX_PIECES} pieces at a time.`);
      return;
    }
    setPieces((p) => [...p, piece]);
    setWeight('');
    setHeight('');
  }

  function removePiece(i: number) {
    setPieces((p) => p.filter((_, idx) => idx !== i));
  }

  async function pay() {
    setError(null);
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = 'Enter your name';
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a phone number we can text';
    const typed = weight.trim() || height.trim() ? validatePiece() : null;
    if (weight.trim() || height.trim()) {
      if (!typed) return;
    }
    setFieldErrors((e) => ({ ...e, ...errs }));
    if (errs.name || errs.phone) return;

    const all = typed ? [...pieces, typed] : pieces;
    if (all.length === 0) {
      setError('Add at least one piece.');
      return;
    }

    setBusy(true);
    const res = await fetch('/api/pay/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), textOptIn, pieces: all }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { url?: string; error?: string } | undefined;
    if (res?.ok && data?.url) {
      window.location.href = data.url;
      return;
    }
    setError(data?.error ?? 'Could not start checkout. Please try again.');
    setBusy(false);
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Field
        label="Your name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setFieldErrors((f) => ({ ...f, name: undefined }));
        }}
        error={fieldErrors.name}
        autoComplete="name"
      />
      <Field
        label="Phone (we text you when it's ready)"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setFieldErrors((f) => ({ ...f, phone: undefined }));
        }}
        error={fieldErrors.phone}
        autoComplete="tel"
      />
      <Field
        label="Email (optional, for the receipt)"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      {pieces.length > 0 && (
        <ul className="divide-sage-stroke bg-sage-fill divide-y rounded-2xl px-4">
          {pieces.map((p, i) => {
            const line = savedQuote?.ok ? savedQuote.lines[i] : null;
            return (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <span className="t-body-sm text-body">
                  {p.weightLb} lb · {p.heightIn}&quot; tall
                  {isOversize(p) ? ' · oversize' : ''}
                  {line ? ` · ${rate(line.rateCentsPerLb)}/lb` : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span className="t-body-sm-bold text-headline">{line ? money(line.chargeCents) : ''}</span>
                  <button
                    type="button"
                    onClick={() => removePiece(i)}
                    aria-label={`Remove piece ${i + 1}`}
                    className="text-headline text-xl leading-none font-bold"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-sage-stroke rounded-2xl border p-4">
        <p className="t-body-sm-bold text-headline mb-3">Price a piece</p>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Weight (lbs)"
            inputMode="decimal"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setFieldErrors((f) => ({ ...f, weight: undefined }));
            }}
            error={fieldErrors.weight}
          />
          <Field
            label="Height at tallest point (in)"
            inputMode="decimal"
            value={height}
            onChange={(e) => {
              setHeight(e.target.value);
              setFieldErrors((f) => ({ ...f, height: undefined }));
            }}
            error={fieldErrors.height}
          />
        </div>
        <p className="t-body-sm text-body mt-3 min-h-5" aria-live="polite">
          {current && currentQuote?.ok
            ? `${currentQuote.lines[0].weightLb.toFixed(1)} lb × ${rate(currentQuote.lines[0].rateCentsPerLb)}/lb = ${money(currentCents)}${
                currentQuote.lines[0].minimumApplied ? ' (minimum per piece)' : ''
              }${isOversize(current) ? ' · over 12 inches' : ''}`
            : current && currentQuote && !currentQuote.ok
              ? currentQuote.reason
              : 'Weigh the piece and measure its tallest point.'}
        </p>
        <Button variant="secondary" block className="mt-3" onClick={addPiece} disabled={busy || !current}>
          Add piece
        </Button>
      </div>

      <Checkbox checked={textOptIn} onChange={setTextOptIn}>
        Text me when my pieces are ready
      </Checkbox>
      <p className="text-body -mt-2 text-[12px] leading-4">{TEXT_CONSENT_WORDING}</p>

      {error && <p className="text-center text-[14px] leading-5 text-[#ff2d55]">{error}</p>}

      <div className="sticky bottom-0 mt-2 bg-white pt-4 pb-4">
        <Button block onClick={pay} disabled={busy || payCents <= 0}>
          {busy ? 'One moment…' : `Pay ${money(payCents)}`}
        </Button>
        <p className="t-body-sm text-body mt-2 text-center">Tax is added at checkout.</p>
      </div>
    </div>
  );
}
