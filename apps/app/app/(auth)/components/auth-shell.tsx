'use client';

import { Button } from '@markerit/ui/components/button';
import { ThemeToggle } from '@markerit/ui';
import { getMessages, type Locale } from '@markerit/i18n';
import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const AuthCopyContext = createContext<ReturnType<typeof getMessages>['auth'] | null>(null);

export function useAuthCopy() {
  const copy = useContext(AuthCopyContext);
  if (!copy) throw new Error('Auth copy must be used within AuthShell.');
  return copy;
}

export function AuthShell({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('pl');
  const copy = useMemo(() => getMessages(locale), [locale]);

  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem('markerit-locale');
      if (savedLocale === 'en' || savedLocale === 'pl') setLocale(savedLocale);
    } catch {
      // Keep the default Polish locale when browser storage is unavailable.
    }
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    try {
      window.localStorage.setItem('markerit-locale', nextLocale);
    } catch {
      // Language switching still works for this visit without browser storage.
    }
  }

  return (
    <AuthCopyContext.Provider value={copy.auth}>
      <main className="flex min-h-screen flex-col bg-muted/40 text-foreground">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8 lg:px-12">
          <Link href="/" aria-label="markerIt" className="text-2xl font-extrabold tracking-[-0.08em]">
            marker<span className="text-primary">It</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle switchToDarkLabel={copy.theme.switchToDark} switchToLightLabel={copy.theme.switchToLight} />
            <div role="group" aria-label={copy.auth.switchLanguage} className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {(['en', 'pl'] as const).map((option) => (
                <Button key={option} type="button" size="sm" variant={locale === option ? 'secondary' : 'ghost'} className="h-7 min-w-8 px-2 text-xs" aria-pressed={locale === option} onClick={() => changeLocale(option)}>
                  {option.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <footer className="px-4 py-5 text-center text-xs text-muted-foreground">© 2026 markerIt</footer>
      </main>
    </AuthCopyContext.Provider>
  );
}
