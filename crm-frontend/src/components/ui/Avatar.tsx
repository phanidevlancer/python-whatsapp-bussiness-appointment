import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      size = 'md',
      showStatus = false,
      status = 'offline',
      ...props
    },
    ref
  ) => {
    const sizes = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
    };

    const statusSizes = {
      xs: 'w-2 h-2',
      sm: 'w-2.5 h-2.5',
      md: 'w-3 h-3',
      lg: 'w-3.5 h-3.5',
      xl: 'w-4 h-4',
    };

    const statusColors = {
      online: 'bg-success-500',
      offline: 'bg-gray-400',
      busy: 'bg-error-500',
      away: 'bg-warning-500',
    };

    const getInitials = (name?: string) => {
      if (!name) return '?';
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    };

    const colors = [
      'bg-primary-100 text-primary-700',
      'bg-success-100 text-success-700',
      'bg-warning-100 text-warning-700',
      'bg-error-100 text-error-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-teal-100 text-teal-700',
    ];

    const getColorIndex = (name?: string) => {
      if (!name) return 0;
      return name.length % colors.length;
    };

    return (
      <div
        ref={ref}
        className={twMerge(
          'relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={twMerge(
              'w-full h-full flex items-center justify-center font-semibold',
              colors[getColorIndex(name)]
            )}
          >
            {getInitials(name)}
          </div>
        )}
        {showStatus && (
          <span
            className={twMerge(
              'absolute bottom-0 right-0 rounded-full border-2 border-white',
              statusSizes[size],
              statusColors[status]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar };
