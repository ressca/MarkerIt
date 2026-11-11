'use client';

import type { Project, Workspace, ProjectStatus } from '../components/types';

const WORKSPACES_PREFIX = 'markerit_workspaces_';
const PROJECTS_PREFIX = 'markerit_projects_';
const ACTIVE_WS_PREFIX = 'markerit_active_workspace_';
const SIDEBAR_COLLAPSED_KEY = 'markerit_sidebar_collapsed';

function userKey(userEmail?: string): string {
  return userEmail?.trim().toLowerCase() || 'anonymous';
}

export function getDefaultWorkspaces(): Workspace[] {
  return [
    {
      id: 'ws-default',
      name: 'Moja przestrzeń',
      role: 'Właściciel',
      initials: 'MP',
      isDefault: true,
    },
  ];
}

export function loadWorkspaces(userEmail?: string): Workspace[] {
  if (typeof window === 'undefined') return getDefaultWorkspaces();
  const key = `${WORKSPACES_PREFIX}${userKey(userEmail)}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const defaults = getDefaultWorkspaces();
      window.localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultWorkspaces();
  } catch {
    return getDefaultWorkspaces();
  }
}

export function saveWorkspaces(workspaces: Workspace[], userEmail?: string): void {
  if (typeof window === 'undefined') return;
  const key = `${WORKSPACES_PREFIX}${userKey(userEmail)}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(workspaces));
  } catch {
    // Ignore storage quota
  }
}

export function getActiveWorkspace(workspaces: Workspace[], userEmail?: string): string {
  const fallback = workspaces[0]?.name || 'Moja przestrzeń';
  if (typeof window === 'undefined') return fallback;

  const saved = window.localStorage.getItem(`${ACTIVE_WS_PREFIX}${userKey(userEmail)}`);
  if (saved && workspaces.some((w) => w.name === saved)) {
    return saved;
  }
  return fallback;
}

export function setActiveWorkspace(name: string, userEmail?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${ACTIVE_WS_PREFIX}${userKey(userEmail)}`, name);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function loadProjects(workspaceName?: string, userEmail?: string): Project[] {
  if (typeof window === 'undefined') return [];
  const key = `${PROJECTS_PREFIX}${userKey(userEmail)}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const projects = parsed as Project[];
    if (!workspaceName) return projects;
    return projects.filter((p) => p.workspace === workspaceName);
  } catch {
    return [];
  }
}

function saveAllProjects(projects: Project[], userEmail?: string): void {
  if (typeof window === 'undefined') return;
  const key = `${PROJECTS_PREFIX}${userKey(userEmail)}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(projects));
  } catch {
    // Ignore storage quota
  }
}

export function saveProject(
  projectData: Omit<Project, 'id' | 'updated'>,
  userEmail?: string
): Project {
  const existing = loadProjects(undefined, userEmail);
  const now = new Date();

  const newProject: Project = {
    ...projectData,
    id: `proj-${now.getTime()}-${Math.random().toString(36).substring(2, 7)}`,
    updated: formatTimestamp(now),
    updatedAt: now.toISOString(),
    createdAt: projectData.createdAt ?? now.toISOString(),
  };

  saveAllProjects([newProject, ...existing], userEmail);
  return newProject;
}

export function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  userEmail?: string
): Project[] {
  const existing = loadProjects(undefined, userEmail);
  const now = new Date();

  const updatedList = existing.map((p) =>
    p.id === id
      ? {
          ...p,
          status,
          updated: formatTimestamp(now),
          updatedAt: now.toISOString(),
        }
      : p
  );
  saveAllProjects(updatedList, userEmail);
  return updatedList;
}

export function deleteProjectById(id: string, userEmail?: string): Project[] {
  const existing = loadProjects(undefined, userEmail);
  const updatedList = existing.filter((p) => p.id !== id);
  saveAllProjects(updatedList, userEmail);
  return updatedList;
}

export function getSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Ignore storage quota
  }
}
