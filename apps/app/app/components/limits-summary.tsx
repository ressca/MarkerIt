'use client';

import { Card, CardContent, Progress } from '@markerit/ui';
import { FolderKanban, Layers } from 'lucide-react';
import { cn } from 'cn';

interface LimitsSummaryProps {
  projectCount: number;
  maxProjects: number;
  workspaceCount: number;
  maxWorkspaces: number;
  className?: string;
}

function plural(amount: number, one: string, few: string, many: string): string {
  if (amount === 1) return one;
  const mod10 = amount % 10;
  const mod100 = amount % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function limitText(
  current: number,
  max: number,
  forms: { one: string; few: string; many: string }
): string {
  const remaining = Math.max(0, max - current);
  if (remaining === 0) return `Limit osiągnięty (${max}/${max})`;
  const noun = plural(remaining, forms.one, forms.few, forms.many);
  return `${remaining === 1 ? 'Pozostało' : 'Pozostały'} ${remaining} ${noun} z ${max}`;
}

export function LimitsSummary({
  projectCount,
  maxProjects,
  workspaceCount,
  maxWorkspaces,
  className,
}: LimitsSummaryProps) {
  return (
    <section
      aria-label="Limity wykorzystania"
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}
    >
      <Card size="sm" className="border-border/70 bg-card/50 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FolderKanban className="size-4" />
              Projekty w tej przestrzeni
            </span>
            <strong className="text-sm font-semibold tabular-nums text-foreground">
              {projectCount} / {maxProjects}
            </strong>
          </div>
          <Progress value={projectCount} max={maxProjects} className="mt-3 h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {limitText(projectCount, maxProjects, { one: 'projekt', few: 'projekty', many: 'projektów' })}
          </p>
        </CardContent>
      </Card>

      <Card size="sm" className="border-border/70 bg-card/50 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Layers className="size-4" />
              Przestrzenie na koncie
            </span>
            <strong className="text-sm font-semibold tabular-nums text-foreground">
              {workspaceCount} / {maxWorkspaces}
            </strong>
          </div>
          <Progress value={workspaceCount} max={maxWorkspaces} className="mt-3 h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {limitText(workspaceCount, maxWorkspaces, { one: 'przestrzeń', few: 'przestrzenie', many: 'przestrzeni' })}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
