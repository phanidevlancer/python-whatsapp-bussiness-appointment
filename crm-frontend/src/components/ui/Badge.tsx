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
      default:  '',
      primary:  '',
      success:  '',
      warning:  '',
      error:    '',
      info:     '',
      teal:     '',
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

    const palette = {
      default: { bg: 'color-mix(in srgb, var(--surface-container-low) 96%, transparent)', text: 'var(--text-secondary)', dot: 'var(--text-secondary)' },
      primary: { bg: 'color-mix(in srgb, var(--primary-50) 94%, transparent)', text: 'var(--primary-700)', dot: 'var(--primary-500)' },
      success: { bg: 'color-mix(in srgb, var(--success-50) 94%, transparent)', text: 'var(--success-600)', dot: 'var(--success-500)' },
      warning: { bg: 'color-mix(in srgb, var(--warning-50) 94%, transparent)', text: 'var(--warning-600)', dot: 'var(--warning-500)' },
      error: { bg: 'color-mix(in srgb, var(--error-50) 94%, transparent)', text: 'var(--error-600)', dot: 'var(--error-500)' },
      info: { bg: 'color-mix(in srgb, var(--info-50) 94%, transparent)', text: 'var(--info-600)', dot: 'var(--info-500)' },
      teal: { bg: 'color-mix(in srgb, var(--primary-50) 94%, transparent)', text: 'var(--primary-600)', dot: 'var(--primary-500)' },
    };

    return (
      <span
        ref={ref}
        className={twMerge(baseStyles, variants[variant], sizes[size], className)}
        style={{
          background: palette[variant].bg,
          color: palette[variant].text,
        }}
        {...props}
      >
        {dot && (
          <span
            className={twMerge('rounded-full', dotSizes[size])}
            style={{ background: palette[variant].dot }}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
