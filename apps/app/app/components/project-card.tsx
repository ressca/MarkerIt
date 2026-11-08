'use client';

import { useState } from 'react';
import { Card, CardContent } from '@markerit/ui/components/card';
import { Badge } from '@markerit/ui/components/badge';
import { Button } from '@markerit/ui/components/button';
import { Avatar, AvatarFallback, AvatarGroup } from '@markerit/ui/components/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@markerit/ui';
import {
  MessageSquare,
  Clock,
  Copy,
  Trash2,
  CheckCircle,
  MoreVertical,
} from 'lucide-react';
import type { Project, ProjectStatus } from './types';
import { cn } from 'cn';

interface ProjectCardProps {
  project: Project;
  onStatusChange?: (id: string, status: ProjectStatus) => void;
  onDelete?: (id: string) => void;
}

const toneGradients: Record<string, string> = {
  sage: 'from-emerald-100 via-teal-100 to-emerald-200 dark:from-emerald-950/60 dark:via-teal-950/40 dark:to-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  sand: 'from-amber-100 via-orange-100 to-amber-200 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-amber-900/40 text-amber-800 dark:text-amber-200',
  blue: 'from-sky-100 via-blue-100 to-indigo-200 dark:from-sky-950/60 dark:via-blue-950/40 dark:to-indigo-900/40 text-sky-800 dark:text-sky-200',
  lilac: 'from-purple-100 via-fuchsia-100 to-violet-200 dark:from-purple-950/60 dark:via-fuchsia-950/40 dark:to-violet-900/40 text-purple-800 dark:text-purple-200',
  emerald: 'from-green-100 via-emerald-100 to-teal-200 dark:from-green-950/60 dark:via-emerald-950/40 dark:to-teal-900/40 text-green-800 dark:text-green-200',
  amber: 'from-yellow-100 via-amber-100 to-orange-200 dark:from-yellow-950/60 dark:via-amber-950/40 dark:to-orange-900/40 text-orange-800 dark:text-orange-200',
};

export function ProjectCard({ project, onStatusChange, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText?.(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMenuOpen(false);
  }

  const gradient = toneGradients[project.tone] || toneGradients.sage;

  return (
    <Card
      size="sm"
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40"
    >
      {/* Top Banner / Preview Thumbnail */}
      <div
        className={cn(
          'relative flex h-32 w-full items-center justify-center overflow-hidden bg-gradient-to-br p-4 transition-transform group-hover:scale-[1.01]',
          gradient
        )}
      >
        {/* Canvas preview styling */}
        <div className="absolute inset-2 rounded-lg border border-white/40 bg-white/20 dark:border-white/10 dark:bg-black/20 backdrop-blur-2xs shadow-inner" />
        
        <div className="relative z-10 flex flex-col items-center gap-1 text-center select-none">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/80 dark:bg-card/80 shadow-xs ring-1 ring-black/5 dark:ring-white/10">
            <span className="font-extrabold text-sm tracking-tight text-primary">m.</span>
          </div>
          <span className="text-[11px] font-semibold opacity-80">{project.workspace}</span>
        </div>

        {/* Status Badge floating on top right */}
        <div className="absolute top-2.5 right-2.5 z-20">
          <Badge
            variant={
              project.status === 'W toku'
                ? 'default'
                : project.status === 'Do sprawdzenia'
                  ? 'secondary'
                  : 'outline'
            }
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium shadow-xs',
              project.status === 'W toku' &&
                'bg-emerald-600 text-white dark:bg-emerald-500 hover:bg-emerald-700',
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
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {project.description || `${project.workspace} · Zespół projektu`}
              </p>
            </div>

            {/* Menu Popover */}
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
                  <span>{copied ? 'Skopiowano!' : 'Kopiuj link do review'}</span>
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
        </div>

        {/* Footer info: Comments, Members, Updated */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <MessageSquare className="size-3.5 text-primary" />
              {project.count} {project.count === 1 ? 'uwaga' : project.count >= 2 && project.count <= 4 ? 'uwagi' : 'uwag'}
            </span>

            {project.members && project.members.length > 0 && (
              <AvatarGroup className="-space-x-1.5">
                {project.members.map((member, i) => (
                  <Avatar key={i} size="sm" className="size-5 border-background font-bold text-[9px]">
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            )}
          </div>

          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {project.updated}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
