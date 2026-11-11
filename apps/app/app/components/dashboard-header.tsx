'use client';

import Link from 'next/link';
import { Menu, Plus, Search, PanelLeft } from 'lucide-react';
import {
  Button,
  Input,
  ThemeToggle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@markerit/ui';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardHeaderProps {
  workspaceName?: string;
  breadcrumbs?: BreadcrumbItem[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onOpenNewProject?: () => void;
  onToggleSidebar?: () => void;
  onOpenMobileMenu?: () => void;
  sidebarCollapsed?: boolean;
  newProjectDisabled?: boolean;
  showDashboardControls?: boolean;
}

export function DashboardHeader({
  workspaceName = 'Główna przestrzeń',
  breadcrumbs,
  searchQuery = '',
  onSearchChange,
  onOpenNewProject,
  onToggleSidebar,
  onOpenMobileMenu,
  sidebarCollapsed = false,
  newProjectDisabled = false,
  showDashboardControls = true,
}: DashboardHeaderProps) {
  const items: BreadcrumbItem[] =
    breadcrumbs ??
    [
      { label: 'Workspace' },
      { label: workspaceName },
      { label: 'Projekty', href: '/' },
    ];

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6">
        {/* Left: Sidebar Toggle & Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-3">
          {onOpenMobileMenu && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onOpenMobileMenu}
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Otwórz menu"
            >
              <Menu className="size-4" />
            </Button>
          )}

          {onToggleSidebar && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onToggleSidebar}
                    className="hidden size-8 shrink-0 text-muted-foreground hover:text-foreground md:inline-flex"
                    aria-label={sidebarCollapsed ? 'Rozwiń pasek boczny' : 'Zwiń pasek boczny'}
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {sidebarCollapsed ? 'Rozwiń pasek boczny (Ctrl+B)' : 'Zwiń pasek boczny (Ctrl+B)'}
              </TooltipContent>
            </Tooltip>
          )}

          <nav
            aria-label="Nawigacja okruszkowa"
            className="breadcrumbs flex min-w-0 items-center overflow-hidden text-xs text-muted-foreground"
          >
            {items.map((item, index) => {
              const last = index === items.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="flex min-w-0 items-center">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="max-w-[150px] truncate transition-colors hover:text-foreground sm:max-w-xs"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        last
                          ? 'max-w-[150px] truncate font-semibold text-foreground sm:max-w-xs'
                          : 'max-w-[150px] truncate sm:max-w-xs'
                      }
                    >
                      {item.label}
                    </span>
                  )}
                  {!last && <span className="mx-2 shrink-0 text-muted-foreground/40">/</span>}
                </span>
              );
            })}
          </nav>
        </div>

        {/* Right: Search, Theme, New Project */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          {showDashboardControls && onSearchChange && (
            <div className="relative hidden w-44 sm:block md:w-60">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Szukaj projektu..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}

          <ThemeToggle
            className="size-8"
            switchToDarkLabel="Włącz czarny motyw"
            switchToLightLabel="Włącz jasny motyw"
          />

          {showDashboardControls && onOpenNewProject && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenNewProject}
              disabled={newProjectDisabled}
              className="primary-button gap-1.5 font-semibold shadow-2xs"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nowy projekt</span>
              <span className="sm:hidden">Nowy</span>
            </Button>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
}
