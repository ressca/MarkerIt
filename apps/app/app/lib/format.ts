import type { Project } from '../components/types';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatProjectUpdated(project: Project): string {
  if (!project.updatedAt) return project.updated;

  const date = new Date(project.updatedAt);
  if (Number.isNaN(date.getTime())) return project.updated;

  const now = new Date();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const time = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  if (dayDiff === 0) return `Dziś, ${time}`;
  if (dayDiff === 1) return `Wczoraj, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString('pl-PL', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

/** Formats an API timestamp using the active interface language. */
export function formatDate(value: string | null | undefined, locale: 'pl' | 'en' = 'pl'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Formats an API timestamp with a short time component. */
export function formatDateTime(value: string | null | undefined, locale: 'pl' | 'en' = 'pl'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function projectTimestamp(project: Project): number {
  const value = project.updatedAt ?? project.createdAt;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
