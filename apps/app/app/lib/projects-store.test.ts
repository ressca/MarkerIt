import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeProjectStatus,
  createProject,
  createWorkspace,
  fetchProjects,
  fetchWorkspaces,
  getActiveWorkspaceId,
  getSidebarCollapsed,
  removeProject,
  setActiveWorkspaceId,
  setSidebarCollapsed,
  toProject,
  toWorkspace,
  updateProjectDetails,
} from './projects-store';
import type { ProjectDto, WorkspaceDto } from '@markerit/api-client';

const {
  listWorkspaces,
  listProjects,
  createWorkspaceRequest,
  createProjectRequest,
  updateProjectRequest,
  deleteProjectRequest,
} = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listProjects: vi.fn(),
  createWorkspaceRequest: vi.fn(),
  createProjectRequest: vi.fn(),
  updateProjectRequest: vi.fn(),
  deleteProjectRequest: vi.fn(),
}));

vi.mock('@markerit/api-client', () => ({
  listWorkspaces,
  listProjects,
  createWorkspace: createWorkspaceRequest,
  createProject: createProjectRequest,
  updateProject: updateProjectRequest,
  deleteProject: deleteProjectRequest,
}));

const workspaceDto: WorkspaceDto = {
  id: 'ws-1',
  name: 'Studio Północ',
  description: null,
  role: 'OWNER',
  projectCount: 2,
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T10:00:00Z',
};

const projectDto: ProjectDto = {
  id: 'p-1',
  workspaceId: 'ws-1',
  name: 'Makieta',
  description: 'Opis',
  status: 'IN_REVIEW',
  tone: 'blue',
  createdBy: 'u-1',
  createdByName: 'Anna Kowalska',
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T11:00:00Z',
  openComments: 4,
  members: [{ id: 'u-1', displayName: 'Anna Kowalska', initials: 'AK' }],
};

describe('projects store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('maps API workspaces and projects to dashboard models', () => {
    const workspace = toWorkspace(workspaceDto);
    expect(workspace).toMatchObject({
      id: 'ws-1',
      name: 'Studio Północ',
      role: 'Właściciel',
      initials: 'SP',
      projectCount: 2,
    });

    const project = toProject(projectDto, workspace.name);
    expect(project).toMatchObject({
      id: 'p-1',
      workspaceId: 'ws-1',
      workspace: 'Studio Północ',
      status: 'Do sprawdzenia',
      tone: 'blue',
      count: 4,
      members: [{ name: 'Anna Kowalska', initials: 'AK' }],
    });
  });

  it('fetches and creates workspaces and projects', async () => {
    listWorkspaces.mockResolvedValue([workspaceDto]);
    listProjects.mockResolvedValue([projectDto]);
    createWorkspaceRequest.mockResolvedValue({ ...workspaceDto, id: 'ws-2', name: 'Nowa' });
    createProjectRequest.mockResolvedValue(projectDto);

    await expect(fetchWorkspaces()).resolves.toHaveLength(1);
    await expect(fetchProjects('ws-1', 'Studio Północ')).resolves.toHaveLength(1);

    const createdWorkspace = await createWorkspace('Nowa');
    expect(createdWorkspace.id).toBe('ws-2');

    const createdProject = await createProject('ws-1', 'Studio Północ', {
      name: 'Makieta',
      description: 'Opis',
      tone: 'blue',
    });
    expect(createdProject.id).toBe('p-1');
    expect(createProjectRequest).toHaveBeenCalledWith('ws-1', {
      name: 'Makieta',
      description: 'Opis',
      tone: 'blue',
    });
  });

  it('updates and deletes projects', async () => {
    const closed = { ...projectDto, status: 'CLOSED' as const };
    updateProjectRequest.mockResolvedValue(closed);

    const changed = await changeProjectStatus(
      toProject(projectDto, 'Studio Północ'),
      'Zamknięty'
    );
    expect(changed.status).toBe('Zamknięty');
    expect(updateProjectRequest).toHaveBeenCalledWith('p-1', { status: 'CLOSED' });

    updateProjectRequest.mockResolvedValue({ ...projectDto, name: 'Nowa nazwa' });
    const updated = await updateProjectDetails(toProject(projectDto, 'Studio Północ'), {
      name: 'Nowa nazwa',
    });
    expect(updated.name).toBe('Nowa nazwa');

    await removeProject('p-1');
    expect(deleteProjectRequest).toHaveBeenCalledWith('p-1');
  });

  it('persists only UI preferences locally', () => {
    expect(getActiveWorkspaceId('a@example.com')).toBeNull();
    setActiveWorkspaceId('ws-1', 'a@example.com');
    expect(getActiveWorkspaceId('A@Example.com')).toBe('ws-1');

    expect(getSidebarCollapsed()).toBe(false);
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
  });
});
