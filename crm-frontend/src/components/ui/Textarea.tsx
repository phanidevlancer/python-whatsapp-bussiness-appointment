import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, TextareaHTMLAttributes, ReactNode } from 'react';

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
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={twMerge(
            `
            w-full px-3 py-2.5 text-sm text-gray-900
            bg-white border border-gray-300 rounded-xl
            transition-all duration-200
            placeholder:text-gray-400
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            hover:border-gray-400
          `,
            resizeStyles[resize],
            error ? 'border-error-500 focus:ring-error-500' : '',
            className
          )}
          disabled={disabled}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-error-600 font-medium">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
