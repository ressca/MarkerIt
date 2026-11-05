import { describe, expect, it } from 'vitest';
import { getMessages, isLocale, locales } from './index';

describe('localization', () => {
  it('provides English and Polish auth and landing copy', () => {
    expect(locales).toEqual(['en', 'pl']);
    expect(getMessages('en').auth.loginTitle).toContain('Sign in');
    expect(getMessages('pl').auth.loginTitle).toContain('Zaloguj');
    expect(getMessages('en').hero.primaryAction).toBeTruthy();
    expect(getMessages('pl').process.steps).toHaveLength(3);
  });

  it('recognizes supported language values', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});
