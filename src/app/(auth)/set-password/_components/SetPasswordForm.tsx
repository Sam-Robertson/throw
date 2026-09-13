'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import type { PasswordEmailMode } from '@/lib/email/passwordSetup';

const MIN_PASSWORD_LENGTH = 8;

export function SetPasswordForm({
  token,
  mode,
  email,
}: {
  token: string;
  mode: PasswordEmailMode;
  email: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? 'Could not set your password. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <CardContent>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          {mode === 'setup' ? 'You’re all set' : 'Password updated'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in with {email} and your new password.
        </Typography>
        <Button component={NextLink} href="/login" variant="contained" fullWidth size="large">
          Sign in
        </Button>
      </CardContent>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          {mode === 'setup' ? 'Set up your account' : 'Reset your password'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {mode === 'setup'
            ? `Choose a password for ${email}. Your membership and class history are already here.`
            : `Choose a new password for ${email}.`}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            id="password"
            name="password"
            type="password"
            label="New password"
            required
            autoComplete="new-password"
            autoFocus
            helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <TextField
            id="confirm"
            name="confirm"
            type="password"
            label="Confirm password"
            required
            autoComplete="new-password"
          />
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2.5, pb: 3 }}>
        <Button type="submit" variant="contained" fullWidth size="large" disabled={pending}>
          {pending ? 'Saving…' : mode === 'setup' ? 'Set password' : 'Update password'}
        </Button>
      </CardActions>
    </Box>
  );
}
