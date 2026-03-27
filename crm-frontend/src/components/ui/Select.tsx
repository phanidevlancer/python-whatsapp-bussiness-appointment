import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  options: { value: string; label: string; disabled?: boolean }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      options,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            className={twMerge(
              `
              w-full px-3 py-2.5 text-sm text-gray-900
              bg-white border border-gray-300 rounded-xl
              transition-all duration-200
              disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              hover:border-gray-400
              appearance-none cursor-pointer
            `,
              leftIcon ? 'pl-10' : '',
              error ? 'border-error-500 focus:ring-error-500' : '',
              className
            )}
            disabled={disabled}
            {...props}
          >
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
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

Select.displayName = 'Select';

export { Select };
