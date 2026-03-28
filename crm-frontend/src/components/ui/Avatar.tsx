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
      sm: 'w-8 h-8 text-xs',
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
      'bg-blue-50 text-blue-600',
      'bg-teal-50 text-teal-600',
      'bg-indigo-50 text-indigo-600',
      'bg-violet-50 text-violet-600',
      'bg-sky-50 text-sky-600',
      'bg-cyan-50 text-cyan-600',
      'bg-blue-50 text-blue-600',
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
              'w-full h-full flex items-center justify-center font-bold',
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
