'use client';

import {
  createProject as createProjectRequest,
  createWorkspace as createWorkspaceRequest,
  deleteProject as deleteProjectRequest,
  listProjects as listProjectsRequest,
  listWorkspaces as listWorkspacesRequest,
  updateProject as updateProjectRequest,
} from '@markerit/api-client';
import type {
  ProjectDto,
  ProjectStatus as ApiProjectStatus,
  UpdateProjectInput,
  WorkspaceDto,
  WorkspaceRole,
} from '@markerit/api-client';
import type { Project, ProjectStatus, Workspace } from '../components/types';

const ACTIVE_WS_PREFIX = 'markerit_active_workspace_id_';
const SIDEBAR_COLLAPSED_KEY = 'markerit_sidebar_collapsed';

const apiToUiStatus: Record<ApiProjectStatus, ProjectStatus> = {
  ACTIVE: 'W toku',
  IN_REVIEW: 'Do sprawdzenia',
  CLOSED: 'Zamknięty',
};

const uiToApiStatus: Record<ProjectStatus, ApiProjectStatus> = {
  'W toku': 'ACTIVE',
  'Do sprawdzenia': 'IN_REVIEW',
  Zamknięty: 'CLOSED',
};

const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: 'Właściciel',
  ADMIN: 'Administrator',
  MEMBER: 'Członek',
  VIEWER: 'Obserwator',
};

function userKey(userEmail?: string): string {
  return userEmail?.trim().toLowerCase() || 'anonymous';
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function toWorkspace(dto: WorkspaceDto): Workspace {
  return {
    id: dto.id,
    name: dto.name,
    role: roleLabels[dto.role] ?? dto.role,
    initials: initials(dto.name),
    isDefault: false,
    projectCount: dto.projectCount,
  };
}

export function toProject(dto: ProjectDto, workspaceName: string): Project {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    workspace: workspaceName,
    name: dto.name,
    description: dto.description ?? undefined,
    status: apiToUiStatus[dto.status] ?? 'W toku',
    count: dto.openComments,
    tone: dto.tone,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    updated: '',
    members: dto.members.map((member) => ({
      id: member.id,
      name: member.displayName,
      initials: member.initials,
    })),
    isShared: false,
  };
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const workspaces = await listWorkspacesRequest();
  return workspaces.map(toWorkspace);
}

export async function fetchProjects(workspaceId: string, workspaceName: string): Promise<Project[]> {
  const projects = await listProjectsRequest(workspaceId);
  return projects.map((project) => toProject(project, workspaceName));
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const workspace = await createWorkspaceRequest({ name });
  return toWorkspace(workspace);
}

export async function createProject(
  workspaceId: string,
  workspaceName: string,
  input: { name: string; description?: string; tone: Project['tone'] }
): Promise<Project> {
  const project = await createProjectRequest(workspaceId, {
    name: input.name,
    description: input.description,
    tone: input.tone,
  });
  return toProject(project, workspaceName);
}

export async function changeProjectStatus(
  project: Project,
  status: ProjectStatus
): Promise<Project> {
  const dto = await updateProjectRequest(project.id, {
    status: uiToApiStatus[status],
  });
  return toProject(dto, project.workspace);
}

export async function updateProjectDetails(
  project: Project,
  input: UpdateProjectInput
): Promise<Project> {
  const dto = await updateProjectRequest(project.id, input);
  return toProject(dto, project.workspace);
}

export async function removeProject(projectId: string): Promise<void> {
  await deleteProjectRequest(projectId);
}

export function getActiveWorkspaceId(userEmail?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`${ACTIVE_WS_PREFIX}${userKey(userEmail)}`);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(workspaceId: string, userEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${ACTIVE_WS_PREFIX}${userKey(userEmail)}`, workspaceId);
  } catch {
    // Ignore storage quota
  }
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
