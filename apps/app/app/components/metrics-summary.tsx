'use client';

import { Card, CardContent } from '@markerit/ui';
import { Layers, MessageSquare, Users2, CheckCircle2 } from 'lucide-react';
import { cn } from 'cn';

interface MetricsSummaryProps {
  totalCount?: number;
  activeCount?: number;
  closedCount?: number;
  openCommentsCount?: number;
  membersCount?: number;
  className?: string;
}

export function MetricsSummary({
  totalCount = 0,
  activeCount = 0,
  closedCount = 0,
  openCommentsCount = 0,
  membersCount = 1,
  className,
}: MetricsSummaryProps) {
  const metrics = [
    {
      id: 'projects',
      label: 'Aktywne projekty',
      value: `${activeCount}`,
      subtext: `z ${totalCount}`,
      icon: Layers,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'comments',
      label: 'Otwarte uwagi',
      value: `${openCommentsCount}`,
      subtext: openCommentsCount === 1 ? 'uwaga' : openCommentsCount >= 2 && openCommentsCount <= 4 ? 'uwagi' : 'uwag',
      icon: MessageSquare,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'closed',
      label: 'Zakończone projekty',
      value: `${closedCount}`,
      subtext: `z ${totalCount}`,
      icon: CheckCircle2,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'members',
      label: 'Osoby w workspace',
      value: `${membersCount}`,
      subtext: membersCount === 1 ? 'właściciel' : 'członków',
      icon: Users2,
      iconBg: 'bg-primary/10 text-primary',
    },
  ];

  return (
    <section
      aria-label="Podsumowanie workspace"
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.id}
            size="sm"
            className="group relative overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                    item.iconBg
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <small className="block text-xs font-medium text-muted-foreground">
                    {item.label}
                  </small>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <strong className="text-xl font-bold tracking-tight text-foreground">
                      {item.value}
                    </strong>
                    <em className="not-italic text-xs text-muted-foreground">{item.subtext}</em>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
