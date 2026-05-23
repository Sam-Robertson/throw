'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { md3 } from '@/lib/theme';

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <>
      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${md3.errorContainer}`,
          p: 2.5,
          bgcolor: `${md3.errorContainer}40`,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Permanently delete your account and all associated data. Any active membership will be
          cancelled. This action cannot be undone.
        </Typography>
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </Button>
      </Box>

      <Dialog
        open={open}
        onClose={() => { setOpen(false); setError(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete your account, cancel any active membership, and remove all
            your data. This cannot be undone.
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Yes, delete my account'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
