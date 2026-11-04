import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
const title = 'markerIt — wizualny feedback do projektów';
const description =
  'Zbieraj precyzyjne uwagi do projektów graficznych. Przypinaj komentarze bezpośrednio do obrazu i sprawniej zamykaj review.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | markerIt',
  },
  description,
  applicationName: 'markerIt',
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'markerIt',
    locale: 'pl_PL',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
