'use client';

import { useState } from 'react';
import { Badge } from '@markerit/ui/components/badge';
import { Button } from '@markerit/ui/components/button';
import { Avatar, AvatarFallback, AvatarGroup } from '@markerit/ui/components/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@markerit/ui';
import {
  MessageSquare,
  Clock,
  MoreVertical,
  Copy,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import type { Project, ProjectStatus } from './types';
import { cn } from 'cn';

interface ProjectRowProps {
  project: Project;
  onStatusChange?: (id: string, status: ProjectStatus) => void;
  onDelete?: (id: string) => void;
}

const toneBorders: Record<string, string> = {
  sage: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
  sand: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  blue: 'border-l-sky-500 bg-sky-50/50 dark:bg-sky-950/20',
  lilac: 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
  emerald: 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20',
  amber: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
};

export function ProjectRow({ project, onStatusChange, onDelete }: ProjectRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText?.(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMenuOpen(false);
  }

  const borderClass = toneBorders[project.tone] || toneBorders.sage;

  return (
    <article
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border border-l-4 bg-card p-3.5 transition-all duration-150 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between',
        borderClass
      )}
    >
      {/* Title & Info */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-xs text-primary ring-1 ring-primary/20">
          m.
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block truncate font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
            {project.name}
          </strong>
          <small className="block truncate text-xs text-muted-foreground">
            {project.workspace}
          </small>
        </div>
      </div>

      {/* Badges, comments, members & timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-5">
        {/* Status */}
        <Badge
          variant={
            project.status === 'W toku'
              ? 'default'
              : project.status === 'Do sprawdzenia'
                ? 'secondary'
                : 'outline'
          }
          className={cn(
            'px-2 py-0.5 text-[10px] font-medium',
            project.status === 'W toku' &&
              'bg-emerald-600 text-white dark:bg-emerald-500',
            project.status === 'Do sprawdzenia' &&
              'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
            project.status === 'Zamknięty' && 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'mr-1.5 size-1.5 rounded-full',
              project.status === 'W toku'
                ? 'bg-white'
                : project.status === 'Do sprawdzenia'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground'
            )}
          />
          {project.status}
        </Badge>

        {/* Comment count */}
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <MessageSquare className="size-3.5 text-primary" />
          <span>{project.count} {project.count === 1 ? 'uwaga' : project.count >= 2 && project.count <= 4 ? 'uwagi' : 'uwag'}</span>
        </span>

        {/* Members */}
        {project.members && project.members.length > 0 && (
          <AvatarGroup className="-space-x-1.5 hidden md:flex">
            {project.members.map((member, i) => (
              <Avatar key={i} size="sm" className="size-5 border-background font-bold text-[9px]">
                <AvatarFallback>{member.initials}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        )}

        {/* Updated */}
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {project.updated}
        </span>

        {/* Action Menu */}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-7 text-muted-foreground hover:text-foreground"
                aria-label={`Więcej opcji: ${project.name}`}
              />
            }
          >
            <MoreVertical className="size-4" />
          </PopoverTrigger>

          <PopoverContent align="end" className="w-48 p-1.5 shadow-xl">
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Copy className="size-3.5 text-muted-foreground" />
              <span>{copied ? 'Skopiowano!' : 'Kopiuj link'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = project.status === 'W toku' ? 'Zamknięty' : 'W toku';
                onStatusChange?.(project.id, next);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <CheckCircle className="size-3.5 text-muted-foreground" />
              <span>
                {project.status === 'W toku' ? 'Oznacz jako zakończony' : 'Wznów projekt'}
              </span>
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                onDelete?.(project.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              <span>Usuń projekt</span>
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </article>
  );
}
