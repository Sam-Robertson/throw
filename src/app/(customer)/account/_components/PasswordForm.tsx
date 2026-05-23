'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

export function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    if (res.ok) {
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Something went wrong');
    }
    setSaving(false);
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        <TextField
          id="pw-current"
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
        <TextField
          id="pw-new"
          label="New password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          slotProps={{ htmlInput: { minLength: 8 } }}
          required
          autoComplete="new-password"
        />
        <TextField
          id="pw-confirm"
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Password updated successfully.</Alert>}

        <Box>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || !current || !next || !confirm}
          >
            {saving ? 'Updating…' : 'Update Password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
