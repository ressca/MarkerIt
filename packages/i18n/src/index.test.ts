import { describe, expect, it } from 'vitest';
import { getMessages, isLocale, locales, messages } from './index';

function flattenKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}${key}`;
    return child !== null && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child, `${path}.`)
      : [path];
  });
}

describe('localization', () => {
  it('provides English and Polish auth and landing copy', () => {
    expect(locales).toEqual(['en', 'pl']);
    expect(getMessages('en').auth.loginTitle).toContain('Sign in');
    expect(getMessages('pl').auth.loginTitle).toContain('Zaloguj');
    expect(getMessages('en').hero.primaryAction).toBeTruthy();
    expect(getMessages('pl').process.steps).toHaveLength(3);
  });

  it('provides project and review-thread copy in both languages', () => {
    expect(getMessages('en').project.newThread).toBe('New thread');
    expect(getMessages('pl').project.newThread).toBe('Nowy wątek');
    expect(getMessages('en').project.photosInProject).toBe('photos in this project');
    expect(getMessages('pl').project.photosInProject).toBe('zdjęć w projekcie');
    expect(getMessages('en').project.discussionTitle).toBe('Discussion');
    expect(getMessages('en').project.staleVersionError).toContain('new version');
    expect(getMessages('pl').project.reviewerLimitHint).toContain('20');
    expect(getMessages('en').project.projectClosedError).toBeTruthy();
  });

  it('provides canvas, pin, comment and realtime copy in both languages', () => {
    expect(getMessages('en').project.discussionTitle).toBe('Discussion');
    expect(getMessages('pl').project.discussionTitle).toBe('Dyskusja');
    expect(getMessages('en').project.addPinTitle).toBeTruthy();
    expect(getMessages('pl').project.pinLabel).toContain('#');
    expect(getMessages('en').project.attachmentsHint).toBeTruthy();
    expect(getMessages('pl').project.realtimeReconnecting).toBeTruthy();
    expect(getMessages('pl').project.realtimeConnecting).toBeTruthy();
    expect(getMessages('en').project.editCommentFor).toContain('{name}');
    expect(getMessages('en').project.discussionClosedNotice).toContain('closed');
  });

  it('provides workspace feedback inbox copy in both languages', () => {
    expect(getMessages('en').feedback.title).toContain('Feedback');
    expect(getMessages('pl').feedback.title).toContain('Uwagi');
    expect(getMessages('en').feedback.results).toContain('{count}');
    expect(getMessages('pl').feedback.results).toContain('{total}');
    expect(getMessages('en').feedback.closedReviewHint).toBeTruthy();
  });

  it('keeps the same translation keys in both languages', () => {
    expect(flattenKeys(messages.pl).sort()).toEqual(flattenKeys(messages.en).sort());
  });

  it('recognizes supported language values', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});
