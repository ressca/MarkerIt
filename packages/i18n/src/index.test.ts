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

  it('provides project and review-thread copy in both languages', () => {
    expect(getMessages('en').project.newThread).toBe('New thread');
    expect(getMessages('pl').project.newThread).toBe('Nowy wątek');
    expect(getMessages('en').project.photosInProject).toBe('photos in this project');
    expect(getMessages('pl').project.photosInProject).toBe('zdjęć w projekcie');
    expect(getMessages('en').project.discussionPlaceholderTitle).toBeTruthy();
    expect(getMessages('pl').project.discussionPlaceholderDescription).toBeTruthy();
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

  it('recognizes supported language values', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});
