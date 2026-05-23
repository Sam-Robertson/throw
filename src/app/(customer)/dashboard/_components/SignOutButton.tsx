'use client';

import { signOut } from 'next-auth/react';
import Button from '@mui/material/Button';

export function SignOutButton() {
  return (
    <Button
      variant="outlined"
      size="small"
      onClick={() => void signOut({ callbackUrl: '/login' })}
    >
      Sign out
    </Button>
  );
}
