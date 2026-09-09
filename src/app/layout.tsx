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
    // Font variables go on <html>, not <body>: globals.css derives --font-serif
    // and --font-sans from them at :root, and a custom property is substituted
    // using the value on the element that declares it — so if --font-gt-alpina
    // were only defined on <body>, --font-serif would resolve to nothing.
    <html lang="en" className={`${satoshi.variable} ${gtAlpina.variable}`}>
      <body>
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
