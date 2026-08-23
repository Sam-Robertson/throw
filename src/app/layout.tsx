import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { MuiProvider } from '@/components/MuiProvider';
import { UTMCapture } from '@/components/UTMCapture';
import { satoshi, gtAlpina } from '@/app/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Throw',
  description: 'Pottery studio booking and membership platform',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${satoshi.variable} ${gtAlpina.variable}`}>
        <AppRouterCacheProvider>
          <MuiProvider>
            <UTMCapture />
            {children}
          </MuiProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
