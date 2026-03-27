import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      children,
      dot = false,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center gap-1.5 font-medium
      rounded-full transition-all duration-200
    `;

    const variants = {
      default: 'bg-gray-100 text-gray-700',
      primary: 'bg-primary-100 text-primary-700',
      success: 'bg-success-100 text-success-700',
      warning: 'bg-warning-100 text-warning-700',
      error: 'bg-error-100 text-error-700',
      info: 'bg-info-100 text-info-700',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1 text-sm',
    };

    const dotSizes = {
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2',
      lg: 'w-2.5 h-2.5',
    };

    const dotColors = {
      default: 'bg-gray-500',
      primary: 'bg-primary-500',
      success: 'bg-success-500',
      warning: 'bg-warning-500',
      error: 'bg-error-500',
      info: 'bg-info-500',
    };

    return (
      <span
        ref={ref}
        className={twMerge(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {dot && (
          <span
            className={twMerge('rounded-full', dotSizes[size], dotColors[variant])}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
