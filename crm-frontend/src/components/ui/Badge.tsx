import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'teal';
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
      inline-flex items-center gap-1 font-medium
      rounded transition-all duration-200
    `;

    const variants = {
      default:  'bg-slate-100 text-slate-600',
      primary:  'bg-blue-50 text-blue-600',
      success:  'bg-green-50 text-green-600',
      warning:  'bg-amber-50 text-amber-600',
      error:    'bg-red-50 text-red-600',
      info:     'bg-blue-50 text-blue-600',
      teal:     'bg-teal-50 text-teal-600',
    };

    const sizes = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-0.5 text-xs',
      lg: 'px-2.5 py-1 text-xs',
    };

    const dotSizes = {
      sm: 'w-1 h-1',
      md: 'w-1.5 h-1.5',
      lg: 'w-2 h-2',
    };

    const dotColors = {
      default:  'bg-slate-500',
      primary:  'bg-blue-500',
      success:  'bg-green-600',
      warning:  'bg-amber-500',
      error:    'bg-red-500',
      info:     'bg-blue-500',
      teal:     'bg-teal-500',
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
