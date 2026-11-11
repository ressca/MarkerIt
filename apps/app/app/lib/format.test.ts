import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './format';

describe('date formatting', () => {
  it('formats API timestamps for both interface languages', () => {
    expect(formatDate('2026-11-11T10:00:00Z', 'en')).toContain('2026');
    expect(formatDate('2026-11-11T10:00:00Z', 'pl')).toContain('2026');
    expect(formatDateTime('2026-11-11T10:00:00Z', 'en')).toContain('2026');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('not-a-date')).toBe('');
  });
});
