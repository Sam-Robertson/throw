'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: '/' })}
      className="t-body-sm-bold text-body hover:text-headline transition-colors"
    >
      Sign out
    </button>
  );
}
