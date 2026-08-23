import localFont from 'next/font/local';

// Satoshi — body/UI sans, per the studio's design system doc.
// Only the weights actually used by the theme are loaded (Regular/Medium/Bold/Black).
export const satoshi = localFont({
  src: [
    { path: './satoshi/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: './satoshi/Satoshi-Medium.woff2', weight: '500', style: 'normal' },
    { path: './satoshi/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
    { path: './satoshi/Satoshi-Black.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-satoshi',
  display: 'swap',
});

// GT Alpina — serif display face for headlines, per the design system doc.
// Only the Standard Regular weight has been supplied so far; every heading
// variant uses weight 400 until a bold cut is sourced.
export const gtAlpina = localFont({
  src: [{ path: './gt-alpina/GT-Alpina-Standard-Regular.woff2', weight: '400', style: 'normal' }],
  variable: '--font-gt-alpina',
  display: 'swap',
});
