import type { HTMLAttributes, ReactNode } from 'react';

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status: 'open' | 'resolved' | 'closed';
  children: ReactNode;
};

export function StatusBadge({ status, className, children, ...props }: StatusBadgeProps) {
  const classes = ['mi-status-badge', `mi-status-badge--${status}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} data-status={status} {...props}>
      {children}
    </span>
  );
}
