'use client';

import { Card, CardContent } from '@markerit/ui/components/card';
import { Layers, MessageSquareDashed, Users2, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { cn } from 'cn';

interface MetricsSummaryProps {
  activeCount?: number;
  totalLimit?: number;
  openCommentsCount?: number;
  membersCount?: number;
  className?: string;
}

export function MetricsSummary({
  activeCount = 3,
  totalLimit = 5,
  openCommentsCount = 6,
  membersCount = 4,
  className,
}: MetricsSummaryProps) {
  const metrics = [
    {
      id: 'projects',
      label: 'Aktywne projekty',
      value: `${activeCount}`,
      subtext: `z ${totalLimit}`,
      trend: '+1 ten tydzień',
      icon: Layers,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'comments',
      label: 'Otwarte uwagi',
      value: `${openCommentsCount}`,
      subtext: 'do przejrzenia',
      trend: '2 priorytetowe',
      icon: MessageSquareDashed,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'members',
      label: 'Osoby w workspace',
      value: `${membersCount}`,
      subtext: 'członków',
      trend: 'Wszyscy aktywni',
      icon: Users2,
      iconBg: 'bg-primary/10 text-primary',
    },
    {
      id: 'resolved',
      label: 'Rozwiązane uwagi',
      value: '24',
      subtext: 'w tym miesiącu',
      trend: 'Tempo 92%',
      icon: CheckCircle2,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
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
            className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30"
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
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
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="size-3.5" />
                </span>
                <span className="text-[10px] text-muted-foreground">{item.trend}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
