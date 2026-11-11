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

export function projectTimestamp(project: Project): number {
  const value = project.updatedAt ?? project.createdAt;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
