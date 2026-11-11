import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'markerIt — Twoje projekty',
  description: 'Zarządzaj projektami i zbieraj wizualne uwagi w markerIt.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
