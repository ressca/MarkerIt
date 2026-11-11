'use client';

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

interface DashboardHeaderProps {
  workspaceName?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewProject: () => void;
  onToggleSidebar?: () => void;
  onOpenMobileMenu?: () => void;
  sidebarCollapsed?: boolean;
}

export function DashboardHeader({
  workspaceName = 'Główna przestrzeń',
  searchQuery,
  onSearchChange,
  onOpenNewProject,
  onToggleSidebar,
  onOpenMobileMenu,
  sidebarCollapsed = false,
}: DashboardHeaderProps) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6">
        {/* Left: Sidebar Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {onOpenMobileMenu && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onOpenMobileMenu}
              className="size-8 text-muted-foreground hover:text-foreground md:hidden"
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
                    className="hidden size-8 text-muted-foreground hover:text-foreground md:inline-flex"
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

          <nav aria-label="Nawigacja okruszkowa" className="breadcrumbs flex items-center text-xs text-muted-foreground">
            <span>Workspace</span>
            <span className="mx-2 text-muted-foreground/40">/</span>
            <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-xs">{workspaceName}</span>
            <span className="mx-2 text-muted-foreground/40">/</span>
            <span className="text-primary font-medium">Projekty</span>
          </nav>
        </div>

        {/* Right: Search, Theme, Help, New Project */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative hidden w-44 sm:block md:w-60">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Szukaj projektu..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <ThemeToggle
            className="size-8"
            switchToDarkLabel="Włącz czarny motyw"
            switchToLightLabel="Włącz jasny motyw"
          />

          <Button
            type="button"
            size="sm"
            onClick={onOpenNewProject}
            className="primary-button gap-1.5 shadow-2xs font-semibold"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nowy projekt</span>
            <span className="sm:hidden">Nowy</span>
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
