'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

interface UserProfile {
  name: string | null;
  email: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export function ProfileForm({ user }: { user: UserProfile }) {
  const [name, setName] = useState(user.name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [ecName, setEcName] = useState(user.emergencyContactName ?? '');
  const [ecPhone, setEcPhone] = useState(user.emergencyContactPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, emergencyContactName: ecName, emergencyContactPhone: ecPhone }),
    });

    if (res.ok) {
      setSuccess(true);
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
          id="profile-name"
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          id="profile-email"
          label="Email"
          value={user.email}
          disabled
          helperText="Email cannot be changed."
        />
        <TextField
          id="profile-phone"
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="ec-name"
              label="Emergency contact name"
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="ec-phone"
              label="Emergency contact phone"
              type="tel"
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Changes saved successfully.</Alert>}

        <Box>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
