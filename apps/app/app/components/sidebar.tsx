'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Share2,
  Archive,
  Users,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@markerit/ui';
import { Badge } from '@markerit/ui/components/badge';
import { Avatar, AvatarFallback } from '@markerit/ui/components/avatar';
import { WorkspaceSwitcher } from './workspace-switcher';
import { cn } from 'cn';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  projectCount?: number;
  sharedCount?: number;
  currentWorkspace?: string;
  onWorkspaceChange?: (workspace: string) => void;
  className?: string;
}

export function Sidebar({
  activeTab = 'projekty',
  onTabChange,
  projectCount = 3,
  sharedCount = 1,
  currentWorkspace = 'Studio Północ',
  onWorkspaceChange,
  className,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = [
    {
      id: 'projekty',
      label: 'Projekty',
      icon: FolderKanban,
      count: projectCount,
      href: '#projekty',
    },
    {
      id: 'shared',
      label: 'Udostępnione',
      icon: Share2,
      count: sharedCount,
      href: '#shared',
    },
    {
      id: 'archive',
      label: 'Archiwum',
      icon: Archive,
      href: '#archiwum',
    },
    {
      id: 'team',
      label: 'Zespół',
      icon: Users,
      href: '#zespol',
    },
  ];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground',
        className
      )}
    >
      {/* Top Wordmark */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-extrabold text-xl tracking-tight text-foreground transition-opacity hover:opacity-90"
          aria-label="markerIt Strona główna"
        >
          <span>marker</span>
          <span className="text-primary">It</span>
        </Link>
        <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
          Beta
        </Badge>
      </div>

      {/* Workspace Switcher */}
      <div className="px-4 pb-3">
        <WorkspaceSwitcher
          currentWorkspace={currentWorkspace}
          onSelectWorkspace={onWorkspaceChange}
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pt-2 pb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
          PRZESTRZEŃ ROBOCZA
        </p>
        <nav className="space-y-1" aria-label="Menu główne">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => {
                  if (onTabChange) {
                    onTabChange(item.id);
                  }
                }}
                className={cn(
                  'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'size-4 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {typeof item.count === 'number' && (
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className={cn(
                      'h-4.5 min-w-4 px-1.5 text-[10px]',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {item.count}
                  </Badge>
                )}
              </a>
            );
          })}
        </nav>

        <p className="px-3 pt-6 pb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
          PREFERENCJE
        </p>
        <div className="space-y-1">
          <a
            href="#ustawienia"
            className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Settings className="size-4 text-muted-foreground group-hover:text-foreground" />
            <span>Ustawienia</span>
          </a>
        </div>
      </div>

      {/* Plan quota & storage widget */}
      <div className="p-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-3 text-xs shadow-2xs">
          <div className="flex items-center justify-between font-medium text-[11px] text-muted-foreground">
            <span>Pakiet Starter</span>
            <span className="font-semibold text-foreground">3 / 5 proj.</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Wykorzystano 60% limitu darmowych projektów.
          </p>
        </div>
      </div>

      {/* User profile footer */}
      <div className="border-t border-border p-3">
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Menu profilu użytkownika"
              />
            }
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar size="sm" className="bg-primary/15 text-primary font-bold text-xs">
                <AvatarFallback>AK</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold text-foreground">
                  Anna Kowalska
                </strong>
                <small className="block truncate text-[11px] text-muted-foreground">
                  anna@studio.pl
                </small>
              </div>
            </div>
            <span className="text-muted-foreground hover:text-foreground">···</span>
          </PopoverTrigger>

          <PopoverContent align="end" side="top" className="w-56 p-1.5 shadow-xl">
            <div className="px-2.5 py-1.5">
              <p className="font-medium text-xs text-foreground">Zalogowano jako</p>
              <p className="truncate text-[11px] text-muted-foreground">anna@studio.pl</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <User className="size-3.5 text-muted-foreground" />
              <span>Twój profil</span>
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Ustawienia konta</span>
            </button>
            <div className="my-1 h-px bg-border" />
            <a
              href="/login"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              <span>Wyloguj się</span>
            </a>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
