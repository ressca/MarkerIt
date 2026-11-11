'use client';

import { useEffect, useState } from 'react';
import { getMessages, isLocale, type Locale } from '@markerit/i18n';

export const APP_LOCALE_KEY = 'markerit-locale';
export const DEFAULT_APP_LOCALE: Locale = 'pl';

/**
 * Reads the interface language selected in the app.
 *
 * Language switching UI ships in a later step; until then `pl` is the
 * fallback and `markerit-locale` is the single source of truth.
 */
export function useAppLocale() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_APP_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(APP_LOCALE_KEY);
      if (stored && isLocale(stored)) {
        setLocale(stored);
      }
    } catch {
      // Storage may be unavailable (private mode); keep the fallback locale.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return { locale, messages: getMessages(locale) };
}
