'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

interface Props {
  initialSms: boolean;
  initialEmail: boolean;
  smsSuppressed: boolean;
  emailSuppressed: boolean;
}

const HELPER_TEXT =
  "Class announcements, promotions, and studio news. We'll always send booking confirmations and reminders regardless of this setting.";

export function CommunicationPreferencesForm({
  initialSms,
  initialEmail,
  smsSuppressed,
  emailSuppressed,
}: Props) {
  const [sms, setSms] = useState(initialSms);
  const [email, setEmail] = useState(initialEmail);
  const [savingKey, setSavingKey] = useState<'smsMarketingOptIn' | 'emailMarketingOptIn' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(key: 'smsMarketingOptIn' | 'emailMarketingOptIn', value: boolean) {
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
      setError('Failed to update your preferences. Please try again.');
    }
    setSavingKey(null);
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={sms && !smsSuppressed}
              disabled={smsSuppressed || savingKey === 'smsMarketingOptIn'}
              onChange={(e) => update('smsMarketingOptIn', e.target.checked)}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Marketing text messages
            </Typography>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
          {HELPER_TEXT}
        </Typography>
        {smsSuppressed && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', ml: 6, mt: 0.5 }}>
            You previously opted out. Contact the studio to re-enable.
          </Typography>
        )}
      </Box>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={email && !emailSuppressed}
              disabled={emailSuppressed || savingKey === 'emailMarketingOptIn'}
              onChange={(e) => update('emailMarketingOptIn', e.target.checked)}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Marketing emails
            </Typography>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
          {HELPER_TEXT}
        </Typography>
        {emailSuppressed && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', ml: 6, mt: 0.5 }}>
            You previously opted out. Contact the studio to re-enable.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
