'use client';

import { useState } from 'react';
import { Toggle } from '@/components/site/Toggle';

interface Props {
  initialSms: boolean;
  initialEmail: boolean;
  smsSuppressed: boolean;
  emailSuppressed: boolean;
}

type Key = 'smsMarketingOptIn' | 'emailMarketingOptIn';

/**
 * "Marketing communication preferences": two switches that save as they are
 * flipped. Someone who replied STOP (a suppression) can't switch texts back
 * on from here; the studio has to clear it.
 */
export function MarketingPreferences({ initialSms, initialEmail, smsSuppressed, emailSuppressed }: Props) {
  const [sms, setSms] = useState(initialSms);
  const [email, setEmail] = useState(initialEmail);
  const [savingKey, setSavingKey] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(key: Key, value: boolean) {
    setSavingKey(key);
    setError(null);
    const res = await fetch('/api/account/marketing-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      if (key === 'smsMarketingOptIn') setSms(value);
      else setEmail(value);
    } else {
      setError('We couldn’t save that. Please try again.');
    }
    setSavingKey(null);
  }

  return (
    <section className="mt-10">
      <h2 className="text-headline text-2xl font-bold">Marketing communication preferences</h2>
      <p className="t-body-sm text-body mt-2">
        Class announcements, promotions, and studio news. We&apos;ll always send booking confirmations and
        reminders regardless of this setting.
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between py-3">
          <span className="t-body-sm-bold text-headline">Email</span>
          <Toggle
            label="Marketing emails"
            checked={email && !emailSuppressed}
            disabled={emailSuppressed || savingKey === 'emailMarketingOptIn'}
            onChange={(next) => update('emailMarketingOptIn', next)}
          />
        </div>
        {emailSuppressed && (
          <p className="text-body -mt-1 mb-2 text-sm">You previously unsubscribed. Contact the studio to re-enable.</p>
        )}
        <div className="flex items-center justify-between py-3">
          <span className="t-body-sm-bold text-headline">Text messages</span>
          <Toggle
            label="Marketing text messages"
            checked={sms && !smsSuppressed}
            disabled={smsSuppressed || savingKey === 'smsMarketingOptIn'}
            onChange={(next) => update('smsMarketingOptIn', next)}
          />
        </div>
        {smsSuppressed && (
          <p className="text-body -mt-1 text-sm">You previously opted out. Contact the studio to re-enable.</p>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-[#ff2d55]">{error}</p>}
    </section>
  );
}
