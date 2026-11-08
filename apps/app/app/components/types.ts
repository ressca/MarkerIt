export type ProjectStatus = 'W toku' | 'Do sprawdzenia' | 'Zamknięty';

export type ProjectTone = 'sage' | 'sand' | 'blue' | 'lilac' | 'emerald' | 'amber';

export interface ProjectMember {
  name: string;
  initials: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace: string;
  status: ProjectStatus;
  count: number;
  tone: ProjectTone;
  updated: string;
  members: ProjectMember[];
  isShared?: boolean;
}

export type ViewMode = 'grid' | 'list';
export type FilterStatus = 'all' | 'in_progress' | 'review' | 'closed';
export type SortOption = 'recent' | 'name' | 'comments';
