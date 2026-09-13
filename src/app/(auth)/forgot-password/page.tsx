'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const email = (new FormData(e.currentTarget).get('email') as string).trim();
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Request failed');
      setSentTo(email);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
              Forgot your password?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email and we&apos;ll send you a link to set a new one. New to the
              online system? This is also how you set up your account.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {sentTo ? (
              <Alert severity="success">
                If an account exists for {sentTo}, we&apos;ve sent a link to set your password.
                It expires in 24 hours. Check your spam folder if it doesn&apos;t arrive in a few
                minutes.
              </Alert>
            ) : (
              <TextField
                id="email"
                name="email"
                type="email"
                label="Email"
                required
                fullWidth
                autoComplete="email"
                autoFocus
              />
            )}
          </CardContent>

          <CardActions sx={{ flexDirection: 'column', gap: 1.5, px: 2.5, pb: 3 }}>
            {!sentTo && (
              <Button type="submit" variant="contained" fullWidth size="large" disabled={pending}>
                {pending ? 'Sending…' : 'Send link'}
              </Button>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              <Link component={NextLink} href="/login" underline="always">
                Back to sign in
              </Link>
            </Typography>
          </CardActions>
        </Box>
      </Card>
    </Box>
  );
}
