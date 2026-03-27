import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2 font-medium
      transition-all duration-200 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
      active:scale-[0.98]
    `;

    const variants = {
      primary: `
        bg-orange-600 text-white
        hover:bg-orange-700
        focus-visible:ring-orange-500
        shadow-sm hover:shadow-md
      `,
      secondary: `
        bg-gray-100 text-gray-900
        hover:bg-gray-200
        focus-visible:ring-gray-500
        shadow-sm
      `,
      outline: `
        bg-transparent border border-gray-300 text-gray-700
        hover:bg-gray-50 hover:border-gray-400
        focus-visible:ring-gray-500
      `,
      ghost: `
        bg-transparent text-gray-700
        hover:bg-gray-100
        focus-visible:ring-gray-500
      `,
      danger: `
        bg-red-600 text-white
        hover:bg-red-700
        focus-visible:ring-red-500
        shadow-sm hover:shadow-md
      `,
      success: `
        bg-green-600 text-white
        hover:bg-green-700
        focus-visible:ring-green-500
        shadow-sm hover:shadow-md
      `,
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-lg',
      md: 'h-10 px-4 text-sm rounded-xl',
      lg: 'h-12 px-6 text-base rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={twMerge(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth ? 'w-full' : '',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
