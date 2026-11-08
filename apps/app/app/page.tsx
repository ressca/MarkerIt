'use client';

import { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List,
  Plus,
  FolderOpen,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@markerit/ui/components/button';
import { Sidebar } from './components/sidebar';
import { DashboardHeader } from './components/dashboard-header';
import { MetricsSummary } from './components/metrics-summary';
import { ProjectCard } from './components/project-card';
import { ProjectRow } from './components/project-row';
import { NewProjectDialog } from './components/new-project-dialog';
import { SharedProjectsSection } from './components/shared-projects-section';
import type { Project, ProjectStatus, ViewMode, FilterStatus, SortOption } from './components/types';
import { cn } from 'cn';

const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Kampania — wiosna',
    description: 'Projekty bannerów, materiałów drukowanych i social media.',
    workspace: 'Studio Północ',
    status: 'W toku',
    count: 4,
    tone: 'sage',
    updated: 'Dziś, 10:42',
    members: [
      { name: 'Anna Kowalska', initials: 'AK' },
      { name: 'Michał Nowak', initials: 'MN' },
    ],
  },
  {
    id: 'proj-2',
    name: 'Opakowanie produktu',
    description: 'Etykieta oraz pudełko linii kosmetyków organicznych.',
    workspace: 'Studio Północ',
    status: 'W toku',
    count: 2,
    tone: 'sand',
    updated: 'Wczoraj',
    members: [
      { name: 'Anna Kowalska', initials: 'AK' },
      { name: 'Piotr Zieliński', initials: 'PZ' },
    ],
  },
  {
    id: 'proj-3',
    name: 'Identyfikacja wizualna',
    description: 'Księga znaku, typografia, paleta barw i wzorce.',
    workspace: 'Projekt osobisty',
    status: 'Zamknięty',
    count: 8,
    tone: 'blue',
    updated: '28 paź',
    members: [
      { name: 'Anna Kowalska', initials: 'AK' },
    ],
  },
];

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeTab, setActiveTab] = useState('projekty');
  const [currentWorkspace, setCurrentWorkspace] = useState('Studio Północ');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter & search logic
  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = project.name.toLowerCase().includes(q);
          const matchDesc = project.description?.toLowerCase().includes(q);
          const matchWs = project.workspace.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchWs) return false;
        }

        // Status filter
        if (filterStatus === 'in_progress') return project.status === 'W toku';
        if (filterStatus === 'review') return project.status === 'Do sprawdzenia';
        if (filterStatus === 'closed') return project.status === 'Zamknięty';

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'pl');
        if (sortBy === 'comments') return b.count - a.count;
        return 0; // default keep recent order
      });
  }, [projects, searchQuery, filterStatus, sortBy]);

  const activeProjectsCount = projects.filter((p) => p.status === 'W toku').length;
  const totalCommentsCount = projects.reduce((sum, p) => sum + p.count, 0);

  function handleCreateProject(newProj: Omit<Project, 'id' | 'updated'>) {
    const created: Project = {
      ...newProj,
      id: `proj-${Date.now()}`,
      updated: 'Przed chwilą',
    };
    setProjects((prev) => [created, ...prev]);
  }

  function handleStatusChange(id: string, status: ProjectStatus) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, updated: 'Przed chwilą' } : p))
    );
  }

  function handleDeleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        projectCount={projects.length}
        sharedCount={1}
        currentWorkspace={currentWorkspace}
        onWorkspaceChange={setCurrentWorkspace}
        className="hidden w-64 shrink-0 md:flex"
      />

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[80vw] bg-sidebar">
            <Sidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              projectCount={projects.length}
              sharedCount={1}
              currentWorkspace={currentWorkspace}
              onWorkspaceChange={setCurrentWorkspace}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <DashboardHeader
          workspaceName={currentWorkspace}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Dashboard Main Scrollable Body */}
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12" id="projekty">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Page Heading Row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {currentWorkspace.toUpperCase()} · WORKSPACE
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Twoje projekty
                </h1>
                <p className="subheading mt-1.5 text-sm text-muted-foreground">
                  Miejsce, w którym zbierają się dobre pomysły i konkretny feedback.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsNewProjectOpen(true)}
                  className="primary-button gap-2 shadow-sm"
                >
                  <Plus className="size-4" />
                  <span>Nowy projekt</span>
                </Button>
              </div>
            </div>

            {/* Metrics Overview */}
            <MetricsSummary
              activeCount={activeProjectsCount}
              totalLimit={5}
              openCommentsCount={totalCommentsCount}
              membersCount={4}
            />

            {/* Projects Section Toolbar */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Ostatnie projekty
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Wróć do miejsca, w którym skończyliście.
                  </p>
                </div>

                {/* Filter tabs & view mode toggle */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Pills */}
                  <div
                    role="group"
                    aria-label="Filtruj po statusie"
                    className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        filterStatus === 'all'
                          ? 'bg-card text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Wszystkie
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('in_progress')}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        filterStatus === 'in_progress'
                          ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      W toku
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('closed')}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                        filterStatus === 'closed'
                          ? 'bg-card text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Zamknięte
                    </button>
                  </div>

                  {/* Sort button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSortBy((s) => (s === 'recent' ? 'name' : s === 'name' ? 'comments' : 'recent'))
                    }
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    title="Zmień sortowanie"
                  >
                    <ArrowUpDown className="size-3.5" />
                    <span className="hidden sm:inline">
                      {sortBy === 'recent' ? 'Ostatnio edytowane' : sortBy === 'name' ? 'Alfabetycznie' : 'Liczba uwag'}
                    </span>
                  </Button>

                  {/* View Mode Toggle: Grid vs List */}
                  <div
                    role="group"
                    aria-label="Widok projektów"
                    className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
                  >
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
                  </div>
                </div>
              </div>

              {/* Projects display */}
              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <FolderOpen className="size-6" />
                  </div>
                  <h3 className="mt-3 font-semibold text-sm text-foreground">
                    Brak pasujących projektów
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {searchQuery
                      ? `Nie znaleziono projektów pasujących do frazy „${searchQuery}”.`
                      : 'Brak projektów w wybranym filtrze.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterStatus('all');
                    }}
                  >
                    Wyczyść filtry
                  </Button>
                </div>
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
                <div className="project-list space-y-2.5">
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

            {/* Shared Projects Section */}
            <SharedProjectsSection />

            {/* Dashboard Footer */}
            <footer className="dashboard-footer flex flex-col items-center justify-between gap-2 border-t border-border pt-6 pb-4 text-xs text-muted-foreground sm:flex-row">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Wszystkie zmiany są zapisane
              </span>
              <span>
                marker<span className="text-primary font-bold">It</span> · spokojniejszy feedback
              </span>
            </footer>
          </div>
        </main>
      </div>

      {/* New Project Dialog Modal */}
      <NewProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        defaultWorkspace={currentWorkspace}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}
