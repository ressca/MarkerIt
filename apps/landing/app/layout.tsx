import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'markerIt — wizualny feedback do projektów',
  description:
    'Zbieraj precyzyjne uwagi do projektów graficznych. Przypinaj komentarze bezpośrednio do obrazu i sprawniej zamykaj review.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
