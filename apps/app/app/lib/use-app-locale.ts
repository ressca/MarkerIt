'use client';

import { useEffect, useState } from 'react';
import { getMessages, isLocale, type Locale } from '@markerit/i18n';

export const APP_LOCALE_KEY = 'markerit-locale';
export const APP_LOCALE_EVENT = 'markerit-locale-change';
export const DEFAULT_APP_LOCALE: Locale = 'pl';

/** Persists the language and notifies every mounted locale hook. */
export function setAppLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_LOCALE_KEY, locale);
  } catch {
    // Storage may be unavailable; still update the current document below.
  }
  window.dispatchEvent(new CustomEvent(APP_LOCALE_EVENT, { detail: locale }));
}

/**
 * Reads the interface language selected in the app.
 *
 * `markerit-locale` is the local source of truth; the account locale seeds it
 * on first render and account settings can change it at any time.
 */
export function useAppLocale() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_APP_LOCALE);

  useEffect(() => {
    function syncFromStorage() {
      try {
        const stored = window.localStorage.getItem(APP_LOCALE_KEY);
        if (stored && isLocale(stored)) setLocale(stored);
      } catch {
        // Storage may be unavailable (private mode); keep the fallback locale.
      }
    }

    function handleLocaleChange(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (isLocale(detail)) {
        setLocale(detail);
      } else {
        syncFromStorage();
      }
    }

    syncFromStorage();
    window.addEventListener(APP_LOCALE_EVENT, handleLocaleChange);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(APP_LOCALE_EVENT, handleLocaleChange);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return { locale, messages: getMessages(locale) };
}
