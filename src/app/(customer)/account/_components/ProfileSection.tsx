'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/site/BottomSheet';
import { Button } from '@/components/site/Button';
import { Field } from '@/components/site/Field';
import { ChevronRight } from '@/components/site/icons';
import {
  formatPhoneDisplay,
  isValidEmail,
  joinName,
  splitName,
} from '@/lib/membershipLifecycle';

interface Profile {
  name: string | null;
  email: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  hasPassword: boolean;
}

type Sheet = 'name' | 'email' | 'phone' | 'emergency' | 'password' | null;

/** One PATCH to the profile route; the error text comes back for the sheet to show. */
async function saveProfile(fields: Record<string, string>): Promise<{ ok: true; user: Profile } | { ok: false; error: string }> {
  const res = await fetch('/api/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<Profile> & { error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? 'Something went wrong. Please try again.' };
  return { ok: true, user: data as Profile };
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between py-4 text-left">
      <span className="min-w-0">
        <span className="t-body-sm text-body block">{label}</span>
        <span className="t-body-sm-bold text-headline block truncate">{value || 'Add'}</span>
      </span>
      <ChevronRight className="text-headline ml-4 size-5 shrink-0" />
    </button>
  );
}

/**
 * The "Profile" rows of the account page and the sheet each one opens. The
 * sheets save one thing at a time, straight to /api/account/profile.
 */
export function ProfileSection({ user: initial }: { user: Profile }) {
  const [user, setUser] = useState(initial);
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const emergency = [user.emergencyContactName, formatPhoneDisplay(user.emergencyContactPhone)]
    .filter(Boolean)
    .join(' | ');

  return (
    <section className="mt-8">
      <h2 className="text-headline text-2xl font-bold">Profile</h2>
      <div className="mt-2">
        <Row label="Name" value={user.name ?? ''} onClick={() => setSheet('name')} />
        <Row label="Email" value={user.email} onClick={() => setSheet('email')} />
        <Row label="Phone" value={formatPhoneDisplay(user.phone)} onClick={() => setSheet('phone')} />
        <Row label="Emergency contact" value={emergency} onClick={() => setSheet('emergency')} />
        <Row
          label="Password"
          value={user.hasPassword ? '••••••••' : 'Set a password'}
          onClick={() => setSheet('password')}
        />
      </div>

      <NameSheet
        open={sheet === 'name'}
        onClose={close}
        name={user.name}
        onSaved={(u) => {
          setUser((prev) => ({ ...prev, ...u }));
          close();
        }}
      />
      <EmailSheet
        open={sheet === 'email'}
        onClose={close}
        email={user.email}
        onSaved={(u) => {
          setUser((prev) => ({ ...prev, ...u }));
          close();
        }}
      />
      <PhoneSheet
        open={sheet === 'phone'}
        onClose={close}
        phone={user.phone}
        onSaved={(u) => {
          setUser((prev) => ({ ...prev, ...u }));
          close();
        }}
      />
      <EmergencySheet
        open={sheet === 'emergency'}
        onClose={close}
        name={user.emergencyContactName}
        phone={user.emergencyContactPhone}
        onSaved={(u) => {
          setUser((prev) => ({ ...prev, ...u }));
          close();
        }}
      />
      <PasswordSheet
        open={sheet === 'password'}
        onClose={close}
        hasPassword={user.hasPassword}
        onSaved={() => {
          setUser((prev) => ({ ...prev, hasPassword: true }));
          close();
        }}
      />
    </section>
  );
}

type SavedHandler = (user: Partial<Profile>) => void;

function NameSheet({
  open,
  onClose,
  name,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  name: string | null;
  onSaved: SavedHandler;
}) {
  const initial = splitName(name);
  const [first, setFirst] = useState(initial.first);
  const [last, setLast] = useState(initial.last);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim()) {
      setError('Please enter your first name');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProfile({ name: joinName(first, last) });
    setSaving(false);
    if (result.ok) onSaved({ name: result.user.name });
    else setError(result.error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit name">
      <form onSubmit={submit} className="space-y-6">
        <Field label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" error={error} />
        <Field label="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
        <Button type="submit" block className="mt-2" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}

function EmailSheet({
  open,
  onClose,
  email: initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  onSaved: SavedHandler;
}) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Invalid email address');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProfile({ email });
    setSaving(false);
    if (result.ok) onSaved({ email: result.user.email });
    else setError(result.error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit email">
      <form onSubmit={submit} className="space-y-6">
        <Field
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          error={error}
        />
        <Button type="submit" block className="mt-2" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}

function PhoneSheet({
  open,
  onClose,
  phone: initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  phone: string | null;
  onSaved: SavedHandler;
}) {
  const [phone, setPhone] = useState(formatPhoneDisplay(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (phone.trim() && digits.length < 10) {
      setError('Please enter a 10 digit mobile number');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProfile({ phone });
    setSaving(false);
    if (result.ok) onSaved({ phone: result.user.phone });
    else setError(result.error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit phone">
      <form onSubmit={submit} className="space-y-6">
        <Field
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) setError(null);
          }}
          error={error}
        />
        <Button type="submit" block className="mt-2" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}

function EmergencySheet({
  open,
  onClose,
  name: initialName,
  phone: initialPhone,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  name: string | null;
  phone: string | null;
  onSaved: SavedHandler;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState(formatPhoneDisplay(initialPhone));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (phone.trim() && digits.length < 10) {
      setError('Please enter a 10 digit mobile number');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProfile({ emergencyContactName: name, emergencyContactPhone: phone });
    setSaving(false);
    if (result.ok)
      onSaved({
        emergencyContactName: result.user.emergencyContactName,
        emergencyContactPhone: result.user.emergencyContactPhone,
      });
    else setError(result.error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Emergency contact">
      <form onSubmit={submit} className="space-y-6">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <Field
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) setError(null);
          }}
          error={error}
        />
        <Button type="submit" block className="mt-2" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}

function PasswordSheet({
  open,
  onClose,
  hasPassword,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  hasPassword: boolean;
  onSaved: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setSaving(false);
    if (res.ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
      onSaved();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={hasPassword ? 'Change password' : 'Set a password'}>
      <form onSubmit={submit} className="space-y-6">
        {hasPassword && (
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error}
        />
        <Button type="submit" block className="mt-2" disabled={saving || !next || !confirm || (hasPassword && !current)}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}
