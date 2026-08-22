'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [smsMarketingOptIn, setSmsMarketingOptIn] = useState(false);
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    const confirmPassword = form.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setPending(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, smsMarketingOptIn, emailMarketingOptIn }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? 'Registration failed');
      setPending(false);
      return;
    }

    const result = await signIn('credentials', { email, password, redirect: false });

    if (result?.error) {
      setError('Account created — please sign in.');
      setPending(false);
      router.push('/login');
    } else {
      router.push('/dashboard');
      router.refresh();
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
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
              Create account
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                id="name"
                name="name"
                type="text"
                label="Name"
                required
                autoComplete="name"
                autoFocus
              />
              <TextField
                id="email"
                name="email"
                type="email"
                label="Email"
                required
                autoComplete="email"
              />
              <TextField
                id="password"
                name="password"
                type="password"
                label="Password"
                required
                slotProps={{ htmlInput: { minLength: 8 } }}
                autoComplete="new-password"
              />
              <TextField
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="Confirm password"
                required
                autoComplete="new-password"
              />

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={smsMarketingOptIn}
                      onChange={(e) => setSmsMarketingOptIn(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Send me text messages about classes and promotions
                    </Typography>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 5 }}>
                  Message and data rates may apply. Reply STOP to opt out.
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={emailMarketingOptIn}
                    onChange={(e) => setEmailMarketingOptIn(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Send me emails about classes and promotions
                  </Typography>
                }
              />
            </Stack>
          </CardContent>

          <CardActions sx={{ flexDirection: 'column', gap: 1.5, px: 2.5, pb: 3 }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={pending}
            >
              {pending ? 'Creating account…' : 'Create account'}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link component={NextLink} href="/login" underline="always">
                Sign in
              </Link>
            </Typography>
          </CardActions>
        </Box>
      </Card>
    </Box>
  );
}
