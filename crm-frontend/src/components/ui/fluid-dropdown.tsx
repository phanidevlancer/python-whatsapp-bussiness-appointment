'use client';

import * as React from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  ChevronDown,
  Layers,
  Clock3,
  CalendarCheck2,
  CheckCheck,
  CircleX,
  CircleOff,
} from 'lucide-react';
import type { AppointmentStatus } from '@/types/appointment';
import { cn } from '@/lib/utils';

function useClickAway(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline';
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variant === 'outline' && 'border border-slate-300 bg-transparent',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

interface Category {
  id: AppointmentStatus | 'all';
  label: string;
  icon: React.ElementType;
  color: string;
}

interface FluidDropdownProps {
  value?: AppointmentStatus;
  onChange: (value: AppointmentStatus | undefined) => void;
  className?: string;
}

const categories: Category[] = [
  { id: 'all', label: 'All', icon: Layers, color: '#64748b' },
  { id: 'pending', label: 'Pending', icon: Clock3, color: '#f59e0b' },
  { id: 'confirmed', label: 'Confirmed', icon: CalendarCheck2, color: '#10b981' },
  { id: 'completed', label: 'Completed', icon: CheckCheck, color: '#0ea5e9' },
  { id: 'cancelled', label: 'Cancelled', icon: CircleX, color: '#ef4444' },
  { id: 'no_show', label: 'No Show', icon: CircleOff, color: '#8b5cf6' },
];

const IconWrapper = ({
  icon: Icon,
  isHovered,
  color,
}: {
  icon: React.ElementType;
  isHovered: boolean;
  color: string;
}) => (
  <motion.div
    className="relative mr-2 h-4 w-4"
    initial={false}
    animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
  >
    <Icon className="h-4 w-4" />
    {isHovered && (
      <motion.div
        className="absolute inset-0"
        style={{ color }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </motion.div>
    )}
  </motion.div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export function FluidDropdown({ value, onChange, className }: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const selectedCategory = categories.find((category) => category.id === (value ?? 'all')) ?? categories[0];
  const activeCategoryId = hoveredCategory || selectedCategory.id;
  const highlightIndex = categories.findIndex((category) => category.id === activeCategoryId);

  useClickAway(dropdownRef, () => setIsOpen(false));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn('relative w-full max-w-md', className)} ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            'h-10 w-full justify-between border-slate-300 bg-white px-3 text-slate-600 shadow-sm',
            'hover:bg-slate-50 hover:text-slate-900',
            'focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white',
            'transition-all duration-200 ease-in-out',
            isOpen && 'bg-slate-50 text-slate-900'
          )}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="flex items-center">
            <IconWrapper
              icon={selectedCategory.icon}
              isHovered={false}
              color={selectedCategory.color}
            />
            {selectedCategory.label}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-5 w-5 items-center justify-center"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 1, y: 0, height: 0 }}
              animate={{
                opacity: 1,
                y: 0,
                height: 'auto',
                transition: {
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              exit={{
                opacity: 0,
                y: 0,
                height: 0,
                transition: {
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              className="absolute left-0 right-0 top-full z-50 mt-2"
              onKeyDown={handleKeyDown}
            >
              <motion.div
                className="w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                initial={{ borderRadius: 8 }}
                animate={{
                  borderRadius: 12,
                  transition: { duration: 0.2 },
                }}
                style={{ transformOrigin: 'top' }}
              >
                <motion.div
                  className="relative py-2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    layoutId="hover-highlight"
                    className="absolute inset-x-1 rounded-md bg-slate-100"
                    animate={{
                      y: highlightIndex * 40 + (highlightIndex > 0 ? 20 : 0),
                      height: 40,
                    }}
                    transition={{
                      type: 'spring',
                      bounce: 0.15,
                      duration: 0.5,
                    }}
                  />
                  {categories.map((category, index) => (
                    <React.Fragment key={category.id}>
                      {index === 1 && (
                        <motion.div
                          className="mx-4 my-2.5 border-t border-slate-200"
                          variants={itemVariants}
                        />
                      )}
                      <motion.button
                        type="button"
                        onClick={() => {
                          onChange(category.id === 'all' ? undefined : category.id);
                          setIsOpen(false);
                        }}
                        onHoverStart={() => setHoveredCategory(category.id)}
                        onHoverEnd={() => setHoveredCategory(null)}
                        className={cn(
                          'relative flex w-full items-center rounded-md px-4 py-2.5 text-sm',
                          'transition-colors duration-150 focus:outline-none',
                          selectedCategory.id === category.id || hoveredCategory === category.id
                            ? 'text-slate-900'
                            : 'text-slate-500'
                        )}
                        whileTap={{ scale: 0.98 }}
                        variants={itemVariants}
                      >
                        <IconWrapper
                          icon={category.icon}
                          isHovered={hoveredCategory === category.id}
                          color={category.color}
                        />
                        {category.label}
                      </motion.button>
                    </React.Fragment>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export function Component(props: FluidDropdownProps) {
  return <FluidDropdown {...props} />;
}
