import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardView } from './components/dashboard-view';
import type { Project, UserProfile, Workspace } from './components/types';

const { createProjectMock } = vi.hoisted(() => ({ createProjectMock: vi.fn() }));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return {
    ...actual,
    createProject: createProjectMock,
  };
});

const user: UserProfile = {
  id: 'user-1',
  email: 'anna.kowalska@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
};

const workspace: Workspace = {
  id: 'ws-default',
  name: 'Moja przestrzeń',
  role: 'Właściciel',
  initials: 'MP',
  isDefault: true,
  projectCount: 3,
};

const projects: Project[] = [
  {
    id: 'proj-1',
    workspaceId: workspace.id,
    name: 'Kampania — wiosna',
    description: 'Projekty bannerów, materiałów drukowanych i social media.',
    workspace: workspace.name,
    status: 'W toku',
    count: 4,
    tone: 'sage',
    updatedAt: new Date().toISOString(),
    updated: 'Dziś',
    members: [{ name: 'Anna Kowalska', initials: 'AK' }],
  },
  {
    id: 'proj-2',
    workspaceId: workspace.id,
    name: 'Opakowanie produktu',
    description: 'Etykieta oraz pudełko linii kosmetyków organicznych.',
    workspace: workspace.name,
    status: 'W toku',
    count: 2,
    tone: 'sand',
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    updated: 'Wczoraj',
    members: [{ name: 'Anna Kowalska', initials: 'AK' }],
  },
  {
    id: 'proj-3',
    workspaceId: workspace.id,
    name: 'Identyfikacja wizualna',
    description: 'Księga znaku, typografia, paleta barw i wzorce.',
    workspace: workspace.name,
    status: 'Zamknięty',
    count: 8,
    tone: 'blue',
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    updated: '3 dni temu',
    members: [{ name: 'Anna Kowalska', initials: 'AK' }],
  },
];

function renderDashboard(overrides: { projects?: Project[] } = {}) {
  return render(
    <DashboardView
      initialUser={user}
      initialProjects={overrides.projects ?? projects}
      initialWorkspaces={[workspace]}
    />
  );
}

describe('DashboardView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    createProjectMock.mockReset();
  });

  it('renders the authenticated user, real counts and the project list', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Twoje projekty' })).toBeInTheDocument();
    expect(screen.getByText(/Zalogowano jako anna\.kowalska@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu główne' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Podsumowanie workspace' })).toBeInTheDocument();

    expect(screen.getByText('Kampania — wiosna')).toBeInTheDocument();
    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.getByText('Identyfikacja wizualna')).toBeInTheDocument();

    // Counts come from the projects themselves (3 projects, 14 comments).
    const summary = screen.getByRole('region', { name: 'Podsumowanie workspace' });
    expect(within(summary).getByText('14')).toBeInTheDocument();
  });

  it('shows namespace usage limits without metric badges', () => {
    renderDashboard();

    const limits = screen.getByRole('region', { name: 'Limity wykorzystania' });
    expect(within(limits).getByText('3 / 3')).toBeInTheDocument();
    expect(within(limits).getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByText(/% całości/)).not.toBeInTheDocument();
  });

  it('shows an honest empty state instead of placeholder projects', () => {
    renderDashboard({ projects: [] });

    expect(screen.getByText('Brak projektów w przestrzeni roboczej')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Utwórz pierwszy projekt/ })).toBeInTheDocument();
  });

  it('filters projects by search term', async () => {
    const testUser = userEvent.setup();
    renderDashboard();

    await testUser.type(screen.getByPlaceholderText('Szukaj projektu...'), 'Opakowanie');

    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();
    expect(screen.queryByText('Identyfikacja wizualna')).not.toBeInTheDocument();
  });

  it('filters projects by status tabs', async () => {
    const testUser = userEvent.setup();
    renderDashboard();

    await testUser.click(screen.getByRole('tab', { name: /Zamknięte/ }));

    expect(screen.getByText('Identyfikacja wizualna')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();

    await testUser.click(screen.getByRole('tab', { name: /W toku/ }));

    expect(screen.getByText('Kampania — wiosna')).toBeInTheDocument();
    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.queryByText('Identyfikacja wizualna')).not.toBeInTheDocument();
  });

  it('shows only shared projects in the shared section', async () => {
    const testUser = userEvent.setup();
    renderDashboard({
      projects: projects.map((project) =>
        project.id === 'proj-2' ? { ...project, isShared: true } : project
      ),
    });

    await testUser.click(screen.getByRole('link', { name: /Udostępnione/ }));

    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();
  });

  it('sorts projects with the shadcn dropdown menu', async () => {
    const testUser = userEvent.setup();
    renderDashboard();

    await testUser.click(screen.getByRole('button', { name: 'Sortuj projekty' }));
    await testUser.click(await screen.findByRole('menuitem', { name: /Alfabetycznie/ }));

    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings[0]).toBe('Identyfikacja wizualna');
  });

  it('toggles between grid and list views', async () => {
    const testUser = userEvent.setup();
    const { container } = renderDashboard();

    expect(container.querySelector('.project-grid')).toBeInTheDocument();

    await testUser.click(screen.getByRole('button', { name: 'Widok listy' }));

    expect(container.querySelector('.project-list')).toBeInTheDocument();
    expect(container.querySelector('.project-grid')).not.toBeInTheDocument();
  });

  it('collapses and expands the full-height sidebar', async () => {
    const testUser = userEvent.setup();
    renderDashboard();

    const sidebar = document.querySelector('aside');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(sidebar).toHaveClass('h-dvh');

    await testUser.click(
      within(sidebar as HTMLElement).getByRole('button', { name: 'Zwiń pasek boczny' })
    );
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await testUser.click(
      within(sidebar as HTMLElement).getByRole('button', { name: 'Rozwiń pasek boczny' })
    );
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  it('creates a project through the API-backed dialog', async () => {
    const testUser = userEvent.setup();
    createProjectMock.mockResolvedValue({
      id: 'proj-new',
      workspaceId: workspace.id,
      name: 'Projekt testowy 2026',
      description: null,
      status: 'ACTIVE',
      tone: 'sage',
      createdBy: user.id,
      createdByName: user.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      openComments: 0,
      members: [{ id: user.id, displayName: user.displayName, initials: user.initials }],
    });

    renderDashboard({ projects: [] });

    const openButtons = screen.getAllByRole('button', { name: /Nowy projekt/i });
    await testUser.click(openButtons[0]);

    expect(screen.getByRole('heading', { name: 'Utwórz nowy projekt' })).toBeInTheDocument();
    expect(screen.getAllByText(/Moja przestrzeń/).length).toBeGreaterThan(0);

    await testUser.type(screen.getByLabelText(/Nazwa projektu/i), 'Projekt testowy 2026');
    await testUser.click(screen.getByRole('button', { name: 'Utwórz projekt' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith(workspace.id, {
        name: 'Projekt testowy 2026',
        description: undefined,
        tone: 'sage',
      });
      expect(screen.getByText('Projekt testowy 2026')).toBeInTheDocument();
    });
  });
});
