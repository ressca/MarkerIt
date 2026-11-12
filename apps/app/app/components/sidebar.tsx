'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Share2,
  Archive,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Separator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@markerit/ui';
import { logoutAccount } from '@markerit/api-client';
import { WorkspaceSwitcher } from './workspace-switcher';
import type { Workspace, UserProfile } from './types';
import { cn } from 'cn';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  projectCount?: number;
  sharedCount?: number;
  closedCount?: number;
  commentsCount?: number;
  workspaces?: Workspace[];
  currentWorkspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
  onAddWorkspace?: (name: string) => void;
  user?: UserProfile | null;
  collapsed?: boolean;
  className?: string;
}

export function Sidebar({
  activeTab = 'projekty',
  onTabChange,
  projectCount = 0,
  sharedCount = 0,
  closedCount = 0,
  commentsCount = 0,
  workspaces = [],
  currentWorkspaceId,
  onWorkspaceChange,
  onAddWorkspace,
  user = null,
  collapsed = false,
  className,
}: SidebarProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const displayUser = user ?? {
    id: 'guest',
    email: '',
    displayName: 'Niezalogowany',
    initials: '—',
  };

  const navItems = [
    {
      id: 'projekty',
      label: 'Projekty',
      icon: FolderKanban,
      count: projectCount,
      href: '#projekty',
    },
    {
      id: 'feedback',
      label: 'Uwagi',
      icon: MessageSquare,
      count: commentsCount,
      href: '/feedback',
    },
    {
      id: 'shared',
      label: 'Udostępnione',
      icon: Share2,
      count: sharedCount,
      href: '#projekty',
    },
    {
      id: 'archive',
      label: 'Archiwum',
      icon: Archive,
      count: closedCount,
      href: '#projekty',
    },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Revoke the API session with CSRF protection, then clear the local
      // cookie through the Next.js route. Both steps are best effort so a
      // network failure cannot trap the user in a signed-in shell.
      try {
        await logoutAccount();
      } catch {
        // The API session may already be expired or unreachable.
      }
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // The local cookie is still cleared below by navigation to /login.
      }
    } finally {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }
  }

  return (
    <TooltipProvider>
      <aside
        data-collapsed={collapsed}
        className={cn(
          'relative flex h-dvh flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out select-none',
          collapsed ? 'w-16 items-center' : 'w-64',
          className
        )}
      >
        {/* Top Header / Logo */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border/50 px-4',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/"
                    className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-extrabold text-sm text-primary"
                    aria-label="markerIt"
                  >
                    m.
                  </Link>
                }
              />
              <TooltipContent side="right">markerIt</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                href="/"
                className="flex items-center gap-1 font-extrabold text-lg tracking-tight text-foreground transition-opacity hover:opacity-90"
                aria-label="markerIt Strona główna"
              >
                <span>marker</span>
                <span className="text-primary">It</span>
              </Link>
              <Badge
                variant="outline"
                className="px-1.5 py-0 text-[10px] font-mono uppercase tracking-wider"
              >
                Beta
              </Badge>
            </>
          )}
        </div>

        {/* Workspace Switcher */}
        <div className={cn('p-3', collapsed && 'p-2')}>
          <WorkspaceSwitcher
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspaceId}
            onSelectWorkspace={onWorkspaceChange}
            onAddWorkspace={onAddWorkspace}
            collapsed={collapsed}
          />
        </div>

        <Separator className="mx-auto w-[calc(100%-1.5rem)]" />

        {/* Navigation list */}
        <div className={cn('flex-1 overflow-y-auto px-3 py-3', collapsed && 'px-2')}>
          {!collapsed && (
            <p className="px-3 pt-1 pb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
              PRZESTRZEŃ ROBOCZA
            </p>
          )}
          <nav className="space-y-1" aria-label="Menu główne">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (collapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger
                      render={
                        <Link
                          href={item.href}
                          onClick={() => onTabChange?.(item.id)}
                          className={cn(
                            'flex size-10 items-center justify-center rounded-lg transition-colors',
                            isActive
                              ? 'bg-primary/10 font-bold text-primary shadow-2xs'
                              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                          aria-label={item.label}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className="size-4" />
                        </Link>
                      }
                    />
                    <TooltipContent side="right">
                      {item.label} ({item.count})
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => onTabChange?.(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary shadow-2xs'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        'size-4 transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className={cn(
                      'h-4.5 min-w-4 px-1.5 text-[10px]',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {item.count}
                  </Badge>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Live workspace summary */}
        {!collapsed && (
          <div className="p-3">
            <Card size="sm" className="border-border/80 bg-card/60 shadow-2xs">
              <CardContent className="space-y-2 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <FolderKanban className="size-3.5" />
                    Projekty
                  </span>
                  <strong className="text-sm font-semibold text-foreground">{projectCount}</strong>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    Uwagi
                  </span>
                  <strong className="text-sm font-semibold text-foreground">{commentsCount}</strong>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* User profile footer */}
        <div className={cn('p-3', collapsed && 'p-2')}>
          <DropdownMenu>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-10 rounded-lg"
                          aria-label={`Profil: ${displayUser.displayName}`}
                        />
                      }
                    >
                      <Avatar
                        size="sm"
                        className="bg-primary/15 font-bold text-xs text-primary"
                      >
                        <AvatarFallback>{displayUser.initials}</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent side="right">
                  <p className="font-medium">{displayUser.displayName}</p>
                  {displayUser.email && (
                    <p className="text-[10px] text-muted-foreground">{displayUser.email}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start gap-2.5 p-2"
                    aria-label="Menu profilu użytkownika"
                  />
                }
              >
                <Avatar size="sm" className="bg-primary/15 font-bold text-xs text-primary">
                  <AvatarFallback>{displayUser.initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left">
                  <strong className="block truncate text-xs font-semibold text-foreground">
                    {displayUser.displayName}
                  </strong>
                  {displayUser.email && (
                    <small className="block truncate text-[11px] text-muted-foreground">
                      {displayUser.email}
                    </small>
                  )}
                </span>
              </DropdownMenuTrigger>
            )}

            <DropdownMenuContent
              align={collapsed ? 'start' : 'end'}
              side={collapsed ? 'right' : 'top'}
              className="w-56"
            >
              <DropdownMenuLabel>Zalogowano jako</DropdownMenuLabel>
              <div className="px-2 pb-1.5">
                <p className="truncate text-xs font-medium text-foreground">
                  {displayUser.displayName}
                </p>
                {displayUser.email && (
                  <p className="truncate text-[11px] text-muted-foreground">{displayUser.email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={loggingOut}
                onClick={handleLogout}
                className="text-destructive data-[highlighted]:bg-destructive/10"
              >
                <LogOut />
                <span>{loggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
