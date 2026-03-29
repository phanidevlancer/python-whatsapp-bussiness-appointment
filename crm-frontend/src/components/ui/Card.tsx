import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      variant = 'default',
      padding = 'md',
      hoverable = false,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      rounded-2xl
      transition-all duration-200
    `;

    const variants = {
      default: 'shadow-sm border',
      elevated: 'shadow-lg border',
      outlined: 'border-2 shadow-none',
    };

    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6',
    };

    const hoverStyles = hoverable
      ? 'hover:shadow-lg hover:border-primary-200 cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        style={{
          background: 'var(--panel-background)',
          borderColor: 'var(--panel-border)',
        }}
        className={twMerge(baseStyles, variants[variant], paddings[padding], hoverStyles, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between pb-4 border-b',
        className
      )}
      style={{ borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={twMerge(
        'text-base font-semibold',
        className
      )}
      style={{ color: 'var(--text-primary)' }}
      {...props}
    >
      {children}
    </h3>
  );
}

interface CardSubtitleProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

function CardSubtitle({ className, children, ...props }: CardSubtitleProps) {
  return (
    <p
      className={twMerge(
        'mt-0.5 text-sm',
        className
      )}
      style={{ color: 'var(--text-secondary)' }}
      {...props}
    >
      {children}
    </p>
  );
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={twMerge('pt-4', className)} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={twMerge(
        'flex items-center gap-3 pt-4 border-t',
        className
      )}
      style={{ borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter };
