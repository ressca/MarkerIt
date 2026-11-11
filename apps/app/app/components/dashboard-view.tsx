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
} from 'lucide-react';
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
} from '@markerit/ui';
import { Sidebar } from './sidebar';
import { DashboardHeader } from './dashboard-header';
import { MetricsSummary } from './metrics-summary';
import { ProjectCard } from './project-card';
import { ProjectRow } from './project-row';
import { NewProjectDialog } from './new-project-dialog';
import { Sheet, SheetContent } from '@markerit/ui';
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
  loadWorkspaces,
  saveWorkspaces,
  getActiveWorkspace,
  setActiveWorkspace,
  loadProjects,
  saveProject,
  updateProjectStatus,
  deleteProjectById,
  getSidebarCollapsed,
  setSidebarCollapsed,
} from '../lib/projects-store';
import { projectTimestamp } from '../lib/format';
import { cn } from 'cn';

interface DashboardViewProps {
  initialUser: UserProfile | null;
  /** Optional fixtures used by tests and previews. */
  initialProjects?: Project[];
  initialWorkspaces?: Workspace[];
}

export function DashboardView({
  initialUser,
  initialProjects,
  initialWorkspaces,
}: DashboardViewProps) {
  const user = initialUser;

  // Workspaces and projects are loaded from this user's local store after mount,
  // so the server-rendered markup and the first client render always match.
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => initialWorkspaces ?? []);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<string>(
    () => initialWorkspaces?.[0]?.name ?? 'Moja przestrzeń'
  );
  const [projects, setProjects] = useState<Project[]>(() => initialProjects ?? []);
  const [loading, setLoading] = useState(initialProjects === undefined);

  // UI state
  const [activeTab, setActiveTab] = useState('projekty');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load persisted data for the authenticated user.
  useEffect(() => {
    if (initialProjects !== undefined) return;

    const userWorkspaces = loadWorkspaces(user?.email);
    const activeWorkspace = getActiveWorkspace(userWorkspaces, user?.email);
    setWorkspaces(userWorkspaces);
    setCurrentWorkspaceState(activeWorkspace);
    setProjects(loadProjects(undefined, user?.email));
    setLoading(false);
  }, [user?.email, initialProjects]);

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

  function handleSelectWorkspace(name: string) {
    setCurrentWorkspaceState(name);
    setActiveWorkspace(name, user?.email);
  }

  function addWorkspace(name: string): Workspace {
    const existing = workspaces.find((w) => w.name === name);
    if (existing) return existing;

    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'WS';

    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      name,
      role: 'Właściciel',
      initials,
      isDefault: false,
    };
    const updated = [...workspaces, newWs];
    setWorkspaces(updated);
    saveWorkspaces(updated, user?.email);
    return newWs;
  }

  function handleAddWorkspace(name: string) {
    addWorkspace(name);
    handleSelectWorkspace(name);
  }

  function handleCreateProject(newProj: Omit<Project, 'id' | 'updated'>) {
    const created = saveProject(newProj, user?.email);
    setProjects((prev) => [created, ...prev]);

    if (created.workspace && created.workspace !== currentWorkspace) {
      addWorkspace(created.workspace);
      handleSelectWorkspace(created.workspace);
    }
  }

  function handleStatusChange(id: string, status: ProjectStatus) {
    const stored = updateProjectStatus(id, status, user?.email);
    const storedProject = stored.find((p) => p.id === id);

    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== id) return project;
        return storedProject ?? { ...project, status };
      })
    );
  }

  function handleDeleteProject(id: string) {
    deleteProjectById(id, user?.email);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setFilterStatus(tab === 'archive' ? 'closed' : 'all');
    setMobileMenuOpen(false);
  }

  // Projects that belong to the active workspace.
  const workspaceProjects = useMemo(() => {
    return projects.filter(
      (p) => !p.workspace || p.workspace === currentWorkspace || currentWorkspace === 'Wszystkie'
    );
  }, [projects, currentWorkspace]);

  const sharedProjects = useMemo(
    () => workspaceProjects.filter((p) => p.isShared),
    [workspaceProjects]
  );

  const inProgressCount = useMemo(
    () => workspaceProjects.filter((p) => p.status === 'W toku').length,
    [workspaceProjects]
  );
  const closedCount = useMemo(
    () => workspaceProjects.filter((p) => p.status === 'Zamknięty').length,
    [workspaceProjects]
  );
  const totalComments = useMemo(
    () => workspaceProjects.reduce((sum, p) => sum + (p.count || 0), 0),
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
          const q = searchQuery.toLowerCase();
          const matchName = project.name.toLowerCase().includes(q);
          const matchDesc = project.description?.toLowerCase().includes(q);
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
              'Rozpocznij pracę, tworząc swój pierwszy projekt. Dodawaj makiety, obrazy i zbieraj precyzyjny feedback z zespołem.',
          };

  const sidebarProps = {
    activeTab,
    onTabChange: handleTabChange,
    projectCount: workspaceProjects.length,
    sharedCount: sharedProjects.length,
    closedCount,
    commentsCount: totalComments,
    workspaces,
    currentWorkspace,
    onWorkspaceChange: handleSelectWorkspace,
    onAddWorkspace: handleAddWorkspace,
    user,
    onToggleCollapse: toggleSidebar,
  };

  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        {/* Desktop full-height collapsible sidebar */}
        <Sidebar {...sidebarProps} collapsed={sidebarCollapsed} className="hidden shrink-0 md:flex" />

        {/* Mobile sidebar drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0" showClose={false}>
            <Sidebar
              {...sidebarProps}
              onWorkspaceChange={(name) => {
                handleSelectWorkspace(name);
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
            workspaceName={currentWorkspace}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenNewProject={() => setIsNewProjectOpen(true)}
            onToggleSidebar={toggleSidebar}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
          />

          {/* Main scrollable body */}
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10" id="projekty">
            <div className="mx-auto max-w-7xl space-y-6 pb-12">
              {/* Page Heading Row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {currentWorkspace.toUpperCase()} · WORKSPACE
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
                    onClick={() => setIsNewProjectOpen(true)}
                    className="primary-button gap-1.5 font-semibold shadow-2xs"
                  >
                    <Plus className="size-4" />
                    <span>Nowy projekt</span>
                  </Button>
                </div>
              </div>

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
                            onClick={() => setIsNewProjectOpen(true)}
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
                  Zmiany w projektach są zapisywane w tej przeglądarce.
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
          defaultWorkspace={currentWorkspace}
          user={user}
          onCreateProject={handleCreateProject}
        />
      </div>
    </TooltipProvider>
  );
}
