import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  tooltip?: string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      children,
      tooltip,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center
      transition-all duration-200
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      active:scale-[0.95]
    `;

    const variants = {
      default: `
        text-gray-500 hover:text-gray-700 hover:bg-gray-100
        focus-visible:ring-gray-500
      `,
      primary: `
        text-primary-600 hover:text-primary-700 hover:bg-primary-50
        focus-visible:ring-primary-500
      `,
      danger: `
        text-error-600 hover:text-error-700 hover:bg-error-50
        focus-visible:ring-error-500
      `,
      ghost: `
        text-gray-500 hover:text-gray-700 hover:bg-transparent
        focus-visible:ring-gray-500
      `,
    };

    const sizes = {
      sm: 'p-1.5 rounded-lg',
      md: 'p-2 rounded-xl',
      lg: 'p-2.5 rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={twMerge(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled}
        data-tooltip={tooltip}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { IconButton };
