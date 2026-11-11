'use client';

import * as React from 'react';
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from 'cn';

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: ProgressPrimitive.Root.Props & { value?: number; max?: number }) {
  const percentage = Math.min(Math.max(0, ((value ?? 0) / (max || 100)) * 100), 100);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-primary transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
