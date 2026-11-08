'use client';

import { Menu, Plus, HelpCircle, Search } from 'lucide-react';
import { Button } from '@markerit/ui/components/button';
import { Input } from '@markerit/ui/components/input';
import { ThemeToggle } from '@markerit/ui';

interface DashboardHeaderProps {
  workspaceName?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewProject: () => void;
  onToggleMobileMenu?: () => void;
}

export function DashboardHeader({
  workspaceName = 'Studio Północ',
  searchQuery,
  onSearchChange,
  onOpenNewProject,
  onToggleMobileMenu,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-8">
      {/* Left: Mobile menu & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleMobileMenu}
            className="md:hidden"
            aria-label="Otwórz menu nawigacji"
          >
            <Menu className="size-5" />
          </Button>
        )}

        <nav aria-label="Nawigacja okruszkowa" className="breadcrumbs flex items-center text-xs text-muted-foreground">
          <span>Workspace</span>
          <span className="mx-2 text-muted-foreground/40">/</span>
          <span className="font-medium text-foreground">{workspaceName}</span>
          <span className="mx-2 text-muted-foreground/40">/</span>
          <span className="text-primary font-medium">Projekty</span>
        </nav>
      </div>

      {/* Right: Quick actions, Search, Theme toggle, New Project */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden w-48 sm:block md:w-64">
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
          variant="outline"
          size="icon-sm"
          className="help-button size-8 rounded-full"
          aria-label="Pomoc"
          title="Centrum pomocy i skróty klawiszowe"
        >
          <HelpCircle className="size-4 text-muted-foreground" />
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onOpenNewProject}
          className="primary-button gap-1.5 shadow-xs"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nowy projekt</span>
          <span className="sm:hidden">Nowy</span>
        </Button>
      </div>
    </header>
  );
}
