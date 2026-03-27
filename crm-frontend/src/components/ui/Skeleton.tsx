import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | false;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseStyles = `
    bg-gray-200
    overflow-hidden
  `;

  const variants = {
    text: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animations = {
    pulse: 'animate-pulse',
    wave: 'relative overflow-hidden after:content-[""] after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-gray-100 after:to-transparent after:animate-[shimmer_1.5s_infinite]',
    false: '',
  } as const;

  const style: React.CSSProperties = {};
  if (width !== undefined) {
    style.width = typeof width === 'string' ? width : `${width}px`;
  }
  if (height !== undefined) {
    style.height = typeof height === 'string' ? height : `${height}px`;
  }

  const animationClass = animation !== false ? animations[animation] : '';

  return (
    <div
      className={twMerge(baseStyles, variants[variant], animationClass, className)}
      style={style}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  gap?: string;
  className?: string;
}

export function SkeletonText({ lines = 1, gap = 'gap-2', className }: SkeletonTextProps) {
  return (
    <div className={twMerge('flex flex-col', gap, className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? 'w-3/4' : undefined}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  showImage?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showContent?: boolean;
  showFooter?: boolean;
  className?: string;
}

export function SkeletonCard({
  showImage = true,
  showTitle = true,
  showSubtitle = false,
  showContent = true,
  showFooter = false,
  className,
}: SkeletonCardProps) {
  return (
    <div className={twMerge('bg-white rounded-2xl border border-gray-200 p-5', className)}>
      {showImage && (
        <Skeleton variant="rounded" className="w-full h-32 mb-4" />
      )}
      {showTitle && <Skeleton variant="text" className="w-2/3 h-5 mb-2" />}
      {showSubtitle && <Skeleton variant="text" className="w-1/2 h-4 mb-3" />}
      {showContent && <SkeletonText lines={2} className="mb-3" />}
      {showFooter && (
        <div className="flex gap-2">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      )}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div className={twMerge('bg-white rounded-2xl border border-gray-200 p-4', className)}>
      <div className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="w-24 h-4" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} variant="text" className="w-24 h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
