import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_LOCALE_KEY, useAppLocale } from './use-app-locale';

describe('useAppLocale', () => {
  beforeEach(() => window.localStorage.clear());

  it('falls back to Polish when no language is stored', () => {
    const { result } = renderHook(() => useAppLocale());
    expect(result.current.locale).toBe('pl');
    expect(result.current.messages.project.newThread).toBe('Nowy wątek');
    expect(document.documentElement.lang).toBe('pl');
  });

  it('reads a supported language from localStorage and updates the document language', async () => {
    window.localStorage.setItem(APP_LOCALE_KEY, 'en');
    document.documentElement.lang = '';
    const { result } = renderHook(() => useAppLocale());

    await waitFor(() => expect(result.current.locale).toBe('en'));
    expect(result.current.messages.project.newThread).toBe('New thread');
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores unsupported language values', () => {
    window.localStorage.setItem(APP_LOCALE_KEY, 'de');
    const { result } = renderHook(() => useAppLocale());
    expect(result.current.locale).toBe('pl');
  });
});
