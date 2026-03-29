import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label ? (
          <Label htmlFor={inputId} className="mb-1.5 block">
            {label}
          </Label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              {leftIcon}
            </div>
          ) : null}
          <input
            type={type}
            id={inputId}
            className={cn(
              'dashboard-surface-input flex h-10 w-full rounded-xl border px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              leftIcon ? 'pl-10' : '',
              rightIcon ? 'pr-10' : '',
              error ? 'border-error-500 focus-visible:ring-error-500' : '',
              className
            )}
            style={{
              background: 'var(--surface-container-lowest)',
              borderColor: error ? undefined : 'var(--border-medium)',
              color: 'var(--text-primary)',
            }}
            ref={ref}
            disabled={disabled}
            {...props}
          />
          {rightIcon ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              {rightIcon}
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-1.5 text-xs font-medium text-error-600">{error}</p> : null}
        {helperText && !error ? <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{helperText}</p> : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
