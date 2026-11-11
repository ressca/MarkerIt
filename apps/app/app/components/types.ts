export type ProjectStatus = 'W toku' | 'Do sprawdzenia' | 'Zamknięty';

export type ProjectTone = 'sage' | 'sand' | 'blue' | 'lilac' | 'emerald' | 'amber';

export interface ProjectMember {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  workspace: string;
  status: ProjectStatus;
  count: number;
  tone: ProjectTone;
  createdAt?: string;
  updated: string;
  updatedAt?: string;
  members: ProjectMember[];
  isShared?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  initials: string;
  isDefault?: boolean;
  projectCount?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  initials: string;
}

export type ViewMode = 'grid' | 'list';
export type FilterStatus = 'all' | 'in_progress' | 'review' | 'closed';
export type SortOption = 'recent' | 'name' | 'comments';
