import { twMerge } from 'tailwind-merge';
import { forwardRef, TextareaHTMLAttributes } from 'react';
import { Label } from '@/components/ui/label';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      resize = 'vertical',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const resizeStyles = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <div className="w-full">
        {label ? <Label htmlFor={textareaId} className="mb-1.5 block">{label}</Label> : null}
        <textarea
          ref={ref}
          id={textareaId}
          className={twMerge(
            `
            dashboard-surface-input w-full rounded-xl px-3 py-2.5 text-sm
            transition-all duration-200
            disabled:cursor-not-allowed disabled:opacity-50
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          `,
            resizeStyles[resize],
            error ? 'border-error-500 focus:ring-error-500' : '',
            className
          )}
          style={{ color: 'var(--text-primary)' }}
          disabled={disabled}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-error-600 font-medium">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
