'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, TooltipProvider } from '@markerit/ui';
import { Sidebar } from './sidebar';
import { DashboardHeader, type BreadcrumbItem } from './dashboard-header';
import {
  createWorkspace as createWorkspaceRequest,
  fetchProjects,
  fetchWorkspaces,
  getActiveWorkspaceId,
  getSidebarCollapsed,
  setActiveWorkspaceId,
  setSidebarCollapsed,
} from '../lib/projects-store';
import { setAppLocale } from '../lib/use-app-locale';
import type { UserProfile, Workspace } from './types';

interface AppShellProps {
  user: UserProfile;
  workspaceId?: string;
  breadcrumbs: BreadcrumbItem[];
  children: ReactNode;
  /** Highlights the matching sidebar entry; defaults to the projects view. */
  activeTab?: string;
  /** Overrides the sidebar feedback badge, e.g. with open notes on `/feedback`. */
  feedbackCount?: number;
}

interface SidebarStats {
  projects: number;
  shared: number;
  closed: number;
  comments: number;
}

const EMPTY_STATS: SidebarStats = { projects: 0, shared: 0, closed: 0, comments: 0 };

export function AppShell({
  user,
  workspaceId,
  breadcrumbs,
  children,
  activeTab = 'projekty',
  feedbackCount,
}: AppShellProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(workspaceId ?? '');
  const [stats, setStats] = useState<SidebarStats>(EMPTY_STATS);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await fetchWorkspaces();
        if (!active) return;
        setWorkspaces(loaded);
        const saved = getActiveWorkspaceId(user.email);
        const selected =
          workspaceId ?? loaded.find((workspace) => workspace.id === saved)?.id ?? loaded[0]?.id ?? '';
        setCurrentWorkspaceId(selected);
      } catch {
        // The page itself surfaces API errors; the shell can stay usable.
      }
    })();
    return () => {
      active = false;
    };
  }, [user.email, workspaceId]);

  useEffect(() => {
    if (workspaceId) setCurrentWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    const workspace = workspaces.find((item) => item.id === currentWorkspaceId);
    if (!workspace) return;

    let active = true;
    (async () => {
      try {
        const projects = await fetchProjects(workspace.id, workspace.name);
        if (!active) return;
        setStats({
          projects: projects.length,
          shared: projects.filter((project) => project.isShared).length,
          closed: projects.filter((project) => project.status === 'Zamknięty').length,
          comments: projects.reduce((sum, project) => sum + (project.count || 0), 0),
        });
      } catch {
        if (active) setStats(EMPTY_STATS);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaces, currentWorkspaceId]);

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  useEffect(() => {
    if (user.locale) setAppLocale(user.locale);
  }, [user.id, user.locale]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0],
    [workspaces, currentWorkspaceId]
  );

  function handleWorkspaceChange(id: string) {
    setCurrentWorkspaceId(id);
    setActiveWorkspaceId(id, user.email);
    setMobileMenuOpen(false);
    router.push('/');
  }

  async function handleAddWorkspace(name: string) {
    try {
      const workspace = await createWorkspaceRequest(name);
      setWorkspaces((previous) => [...previous, workspace]);
      handleWorkspaceChange(workspace.id);
    } catch {
      // Creation errors are surfaced by the dashboard form; keep the shell stable.
    }
  }

  const sidebarProps = {
    activeTab,
    // Navigation is handled by the sidebar links themselves. Pushing here as
    // well would resolve hash-only hrefs against the current page and could
    // strand the user on a non-dashboard route.
    onTabChange: () => setMobileMenuOpen(false),
    projectCount: stats.projects,
    sharedCount: stats.shared,
    closedCount: stats.closed,
    commentsCount: feedbackCount ?? stats.comments,
    workspaces,
    currentWorkspaceId: currentWorkspace?.id,
    onWorkspaceChange: handleWorkspaceChange,
    onAddWorkspace: handleAddWorkspace,
    user,
  };

  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          className="hidden shrink-0 md:flex"
        />

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0" showClose={false}>
            <Sidebar
              {...sidebarProps}
              onWorkspaceChange={handleWorkspaceChange}
              collapsed={false}
              className="w-full border-0"
            />
          </SheetContent>
        </Sheet>

        <div className="flex h-dvh flex-1 flex-col overflow-hidden">
          <DashboardHeader
            workspaceName={currentWorkspace?.name}
            breadcrumbs={[
              { label: 'Workspace' },
              ...(currentWorkspace ? [{ label: currentWorkspace.name }] : []),
              ...breadcrumbs,
            ]}
            showDashboardControls={false}
            onToggleSidebar={toggleSidebar}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            sidebarCollapsed={collapsed}
          />

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
