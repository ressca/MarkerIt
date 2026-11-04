import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = ['mi-button', `mi-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} data-variant={variant} {...props}>
      {children}
    </button>
  );
}
