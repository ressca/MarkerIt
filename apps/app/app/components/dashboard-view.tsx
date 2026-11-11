'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  List,
  Plus,
  ArrowUpDown,
  FolderPlus,
  Check,
  Share2,
  Archive,
  X,
} from 'lucide-react';
import { ApiError } from '@markerit/api-client';
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  Card,
  CardContent,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Separator,
  Sheet,
  SheetContent,
} from '@markerit/ui';
import { Sidebar } from './sidebar';
import { DashboardHeader } from './dashboard-header';
import { MetricsSummary } from './metrics-summary';
import { ProjectCard } from './project-card';
import { ProjectRow } from './project-row';
import { NewProjectDialog, type NewProjectValues } from './new-project-dialog';
import type {
  Project,
  ProjectStatus,
  ViewMode,
  FilterStatus,
  SortOption,
  Workspace,
  UserProfile,
} from './types';
import {
  fetchWorkspaces,
  fetchProjects,
  createWorkspace as createWorkspaceRequest,
  createProject as createProjectRequest,
  changeProjectStatus,
  removeProject,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  getSidebarCollapsed,
  setSidebarCollapsed,
} from '../lib/projects-store';
import { projectTimestamp } from '../lib/format';
import { cn } from 'cn';

const MAX_WORKSPACES = 3;
const MAX_PROJECTS = 3;

interface DashboardViewProps {
  initialUser: UserProfile | null;
  /** Optional fixtures used by tests and previews. */
  initialProjects?: Project[];
  initialWorkspaces?: Workspace[];
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  return 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
}

export function DashboardView({
  initialUser,
  initialProjects,
  initialWorkspaces,
}: DashboardViewProps) {
  const user = initialUser;

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => initialWorkspaces ?? []);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(
    () => initialWorkspaces?.[0]?.id ?? ''
  );
  const [projects, setProjects] = useState<Project[]>(() => initialProjects ?? []);
  const [loading, setLoading] = useState(
    initialProjects === undefined || initialWorkspaces === undefined
  );
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState('projekty');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load the signed-in user's workspaces and projects from the API.
  useEffect(() => {
    if (initialProjects !== undefined && initialWorkspaces !== undefined) return;

    let active = true;
    setLoading(true);

    (async () => {
      try {
        const loadedWorkspaces = await fetchWorkspaces();
        if (!active) return;

        setWorkspaces(loadedWorkspaces);
        const savedId = getActiveWorkspaceId(user?.email);
        const selected =
          loadedWorkspaces.find((workspace) => workspace.id === savedId) ?? loadedWorkspaces[0];

        if (!selected) {
          setCurrentWorkspaceId('');
          setProjects([]);
          return;
        }

        setCurrentWorkspaceId(selected.id);
        setActiveWorkspaceId(selected.id, user?.email);
        setProjects(await fetchProjects(selected.id, selected.name));
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.email, initialProjects, initialWorkspaces]);

  // Restore the collapsed preference without breaking hydration.
  useEffect(() => {
    setSidebarCollapsedState(getSidebarCollapsed());
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  // Global keyboard shortcut (Ctrl+B / Cmd+B) to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const currentWorkspace =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const currentWorkspaceName = currentWorkspace?.name ?? 'Moja przestrzeń';

  async function selectWorkspace(workspace: Workspace) {
    setCurrentWorkspaceId(workspace.id);
    setActiveWorkspaceId(workspace.id, user?.email);
    setMobileMenuOpen(false);
    setLoading(true);
    try {
      if (initialProjects !== undefined) {
        setProjects(initialProjects.filter((project) => project.workspaceId === workspace.id));
      } else {
        setProjects(await fetchProjects(workspace.id, workspace.name));
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  function handleSelectWorkspace(workspaceId: string) {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (workspace) void selectWorkspace(workspace);
  }

  async function handleAddWorkspace(name: string) {
    const ownedWorkspaces = workspaces.filter(
      (workspace) => workspace.role === 'Właściciel'
    ).length;
    if (ownedWorkspaces >= MAX_WORKSPACES) {
      setError(`Możesz mieć maksymalnie ${MAX_WORKSPACES} przestrzenie robocze.`);
      return;
    }
    try {
      setError(null);
      const workspace = await createWorkspaceRequest(name);
      setWorkspaces((prev) => [...prev, workspace]);
      await selectWorkspace(workspace);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function handleCreateProject(values: NewProjectValues): Promise<boolean> {
    if (!currentWorkspace) {
      setError('Najpierw wybierz przestrzeń roboczą.');
      return false;
    }
    if (workspaceProjects.length >= MAX_PROJECTS) {
      setError(`Każda przestrzeń może mieć maksymalnie ${MAX_PROJECTS} projekty.`);
      return false;
    }

    try {
      setError(null);
      const created = await createProjectRequest(currentWorkspace.id, currentWorkspace.name, values);
      setProjects((prev) => [created, ...prev]);
      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === currentWorkspace.id
            ? { ...workspace, projectCount: (workspace.projectCount ?? 0) + 1 }
            : workspace
        )
      );
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }

  async function handleStatusChange(id: string, status: ProjectStatus) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;

    try {
      setError(null);
      const updated = await changeProjectStatus(project, status);
      setProjects((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function handleDeleteProject(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;

    try {
      setError(null);
      await removeProject(id);
      setProjects((prev) => prev.filter((item) => item.id !== id));
      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === project.workspaceId
            ? { ...workspace, projectCount: Math.max(0, (workspace.projectCount ?? 1) - 1) }
            : workspace
        )
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setFilterStatus(tab === 'archive' ? 'closed' : 'all');
    setMobileMenuOpen(false);
  }

  function openNewProject() {
    if (workspaceProjects.length >= MAX_PROJECTS) {
      setError(`Każda przestrzeń może mieć maksymalnie ${MAX_PROJECTS} projekty.`);
      return;
    }
    setError(null);
    setIsNewProjectOpen(true);
  }

  // Projects that belong to the active workspace.
  const workspaceProjects = useMemo(() => {
    if (!currentWorkspace) return projects;
    return projects.filter(
      (project) =>
        project.workspaceId === currentWorkspace.id || project.workspace === currentWorkspace.name
    );
  }, [projects, currentWorkspace]);

  const sharedProjects = useMemo(
    () => workspaceProjects.filter((project) => project.isShared),
    [workspaceProjects]
  );

  const inProgressCount = useMemo(
    () => workspaceProjects.filter((project) => project.status === 'W toku').length,
    [workspaceProjects]
  );
  const closedCount = useMemo(
    () => workspaceProjects.filter((project) => project.status === 'Zamknięty').length,
    [workspaceProjects]
  );
  const totalComments = useMemo(
    () => workspaceProjects.reduce((sum, project) => sum + (project.count || 0), 0),
    [workspaceProjects]
  );

  const membersCount = useMemo(() => {
    const members = new Set<string>();
    if (user?.displayName) members.add(user.displayName);
    for (const project of workspaceProjects) {
      for (const member of project.members ?? []) members.add(member.name);
    }
    return members.size;
  }, [workspaceProjects, user?.displayName]);

  const filteredProjects = useMemo(() => {
    const base = activeTab === 'shared' ? sharedProjects : workspaceProjects;

    return base
      .filter((project) => {
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchName = project.name.toLowerCase().includes(query);
          const matchDesc = project.description?.toLowerCase().includes(query);
          if (!matchName && !matchDesc) return false;
        }

        if (filterStatus === 'in_progress') return project.status === 'W toku';
        if (filterStatus === 'closed') return project.status === 'Zamknięty';
        if (filterStatus === 'review') return project.status === 'Do sprawdzenia';

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'pl');
        if (sortBy === 'comments') return b.count - a.count;
        return projectTimestamp(b) - projectTimestamp(a);
      });
  }, [activeTab, sharedProjects, workspaceProjects, searchQuery, filterStatus, sortBy]);

  const sortLabels: Record<SortOption, string> = {
    recent: 'Ostatnio edytowane',
    name: 'Alfabetycznie (A-Z)',
    comments: 'Liczba uwag',
  };

  const canCreateProject = workspaceProjects.length < MAX_PROJECTS;

  const emptyState = searchQuery
    ? {
        title: 'Brak pasujących projektów',
        description: `Nie znaleziono projektów pasujących do frazy „${searchQuery}”.`,
      }
    : activeTab === 'shared'
      ? {
          title: 'Brak udostępnionych projektów',
          description:
            'Gdy udostępnisz projekt lub ktoś doda Cię do współpracy, pojawi się w tym miejscu.',
        }
      : activeTab === 'archive'
        ? {
            title: 'Archiwum jest puste',
            description: 'Zakończone projekty pojawią się tutaj, gdy oznaczysz je jako zamknięte.',
          }
        : {
            title: 'Brak projektów w przestrzeni roboczej',
            description:
              'Rozpocznij pracę, tworząc swój pierwszy projekt. Dodawaj zdjęcia do review i zbieraj precyzyjny feedback z zespołem.',
          };

  const sidebarProps = {
    activeTab,
    onTabChange: handleTabChange,
    projectCount: workspaceProjects.length,
    sharedCount: sharedProjects.length,
    closedCount,
    commentsCount: totalComments,
    workspaces,
    currentWorkspaceId: currentWorkspace?.id,
    onWorkspaceChange: handleSelectWorkspace,
    onAddWorkspace: handleAddWorkspace,
    user,
    onToggleCollapse: toggleSidebar,
  };

  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        {/* Desktop full-height collapsible sidebar */}
        <Sidebar
          {...sidebarProps}
          collapsed={sidebarCollapsed}
          className="hidden shrink-0 md:flex"
        />

        {/* Mobile sidebar drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0" showClose={false}>
            <Sidebar
              {...sidebarProps}
              onWorkspaceChange={(workspaceId) => {
                handleSelectWorkspace(workspaceId);
                setMobileMenuOpen(false);
              }}
              onToggleCollapse={undefined}
              collapsed={false}
              className="w-full border-0"
            />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex h-dvh flex-1 flex-col overflow-hidden">
          <DashboardHeader
            workspaceName={currentWorkspaceName}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenNewProject={openNewProject}
            onToggleSidebar={toggleSidebar}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            newProjectDisabled={!canCreateProject}
          />

          {/* Main scrollable body */}
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10" id="projekty">
            <div className="mx-auto max-w-7xl space-y-6 pb-12">
              {/* Page Heading Row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {currentWorkspaceName.toUpperCase()} · WORKSPACE
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Twoje projekty
                  </h1>
                  <p className="subheading mt-1 text-xs text-muted-foreground sm:text-sm">
                    {user?.email
                      ? `Zalogowano jako ${user.email}. Zarządzaj swoimi projektami i zbieraj uwagi.`
                      : 'Miejsce, w którym zbierają się dobre pomysły i konkretny feedback.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={openNewProject}
                    disabled={!canCreateProject}
                    className="primary-button gap-1.5 font-semibold shadow-2xs"
                  >
                    <Plus className="size-4" />
                    <span>Nowy projekt</span>
                  </Button>
                </div>
              </div>

              {/* API / limit errors */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <span className="leading-relaxed">{error}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setError(null)}
                    aria-label="Zamknij komunikat błędu"
                    className="size-5 shrink-0 text-destructive hover:bg-destructive/15"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* Live metrics computed from the user's projects */}
              <MetricsSummary
                totalCount={workspaceProjects.length}
                activeCount={inProgressCount}
                closedCount={closedCount}
                openCommentsCount={totalComments}
                membersCount={membersCount}
              />

              {/* Toolbar: status tabs, sort, view mode */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      {activeTab === 'shared' ? 'Udostępnione projekty' : 'Projekty w przestrzeni'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {workspaceProjects.length > 0
                        ? `Wyświetlono ${filteredProjects.length} z ${workspaceProjects.length} projektów.`
                        : 'Brak projektów. Utwórz swój pierwszy projekt.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Tabs using shadcn Tabs */}
                    <Tabs
                      value={filterStatus}
                      onValueChange={(val) => {
                        setFilterStatus(val as FilterStatus);
                        setActiveTab(val === 'closed' ? 'archive' : 'projekty');
                      }}
                    >
                      <TabsList>
                        <TabsTrigger value="all">
                          Wszystkie ({workspaceProjects.length})
                        </TabsTrigger>
                        <TabsTrigger value="in_progress">
                          W toku ({inProgressCount})
                        </TabsTrigger>
                        <TabsTrigger value="closed">
                          Zamknięte ({closedCount})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Sort dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            aria-label="Sortuj projekty"
                          />
                        }
                      >
                        <ArrowUpDown className="size-3.5" />
                        <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Sortowanie</DropdownMenuLabel>
                        {(['recent', 'name', 'comments'] as const).map((key) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => setSortBy(key)}
                            className={cn(
                              sortBy === key && 'bg-primary/10 font-semibold text-primary'
                            )}
                          >
                            <span className="flex-1">{sortLabels[key]}</span>
                            {sortBy === key && <Check className="size-3.5 text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* View Mode Toggle */}
                    <div
                      role="group"
                      aria-label="Widok projektów"
                      className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
                    >
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                              size="icon-xs"
                              onClick={() => setViewMode('grid')}
                              aria-label="Widok siatki"
                              className="size-7"
                            >
                              <LayoutGrid className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>Widok siatki</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                              size="icon-xs"
                              onClick={() => setViewMode('list')}
                              aria-label="Widok listy"
                              className="size-7"
                            >
                              <List className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent>Widok listy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Projects Display / Empty State */}
                {loading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card key={index} size="sm">
                        <CardContent className="space-y-3 p-4">
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-1/2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <Card className="flex flex-col items-center justify-center border-dashed py-14 text-center">
                    <CardContent className="flex max-w-md flex-col items-center p-6">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {activeTab === 'shared' ? (
                          <Share2 className="size-7" />
                        ) : activeTab === 'archive' ? (
                          <Archive className="size-7" />
                        ) : (
                          <FolderPlus className="size-7" />
                        )}
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-foreground">
                        {emptyState.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {emptyState.description}
                      </p>
                      <div className="mt-5 flex items-center gap-2">
                        {searchQuery ? (
                          <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                            Wyczyść filtr
                          </Button>
                        ) : activeTab === 'projekty' ? (
                          <Button
                            size="sm"
                            onClick={openNewProject}
                            disabled={!canCreateProject}
                            className="gap-1.5"
                          >
                            <Plus className="size-4" />
                            <span>Utwórz pierwszy projekt</span>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : viewMode === 'grid' ? (
                  <div className="project-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteProject}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="project-list space-y-2">
                    {filteredProjects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteProject}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator className="mt-8" />

              {/* Dashboard Footer */}
              <footer className="dashboard-footer flex flex-col items-center justify-between gap-2 pt-4 pb-2 text-xs text-muted-foreground sm:flex-row">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Wszystkie zmiany są zapisywane w bazie danych.
                </span>
                <span>
                  marker<span className="font-bold text-primary">It</span> · spokojniejszy feedback
                </span>
              </footer>
            </div>
          </main>
        </div>

        {/* New Project Dialog */}
        <NewProjectDialog
          open={isNewProjectOpen}
          onOpenChange={setIsNewProjectOpen}
          workspaceName={currentWorkspaceName}
          onCreateProject={handleCreateProject}
        />
      </div>
    </TooltipProvider>
  );
}
