'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
import Stack from '@mui/material/Stack';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: form.get('email') as string,
      password: form.get('password') as string,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setPending(false);
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
              Sign in
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                id="email"
                name="email"
                type="email"
                label="Email"
                required
                autoComplete="email"
                autoFocus
              />
              <TextField
                id="password"
                name="password"
                type="password"
                label="Password"
                required
                autoComplete="current-password"
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
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Don&apos;t have an account?{' '}
              <Link component={NextLink} href="/register" underline="always">
                Register
              </Link>
            </Typography>
          </CardActions>
        </Box>
      </Card>
    </Box>
  );
}
