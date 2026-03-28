'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, CalendarDays, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface StackedActivityCardItem {
  id: string | number;
  activity: string;
  location: string;
  date: string;
  color?: string;
  icon?: LucideIcon;
  href?: string;
}

export interface StackedActivityCardsProps {
  items?: StackedActivityCardItem[];
  className?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  emptyMessage?: string;
}

const DEFAULT_ITEMS: StackedActivityCardItem[] = [
  {
    id: 1,
    activity: 'Mountain Hiking',
    location: 'Mount Rainier',
    date: '12 August',
    color: '#ff7e5f',
  },
  {
    id: 2,
    activity: 'Surfing Lesson',
    location: 'Malibu Beach',
    date: '8 August',
    color: '#0396FF',
  },
  {
    id: 3,
    activity: 'Wine Tasting',
    location: 'Napa Valley',
    date: '30 July',
    color: '#7367F0',
  },
];

export function StackedActivityCards({
  items = DEFAULT_ITEMS,
  className,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  emptyMessage = 'No activities available.',
}: StackedActivityCardsProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;

  const previewItems = useMemo(() => items.slice(0, 3), [items]);
  const collapsedOverlap = 62;
  const springTransition = {
    type: 'spring',
    stiffness: 320,
    damping: 30,
    mass: 0.8,
  } as const;
  const fadeTransition = {
    duration: 0.2,
    ease: 'easeOut',
  } as const;

  if (!previewItems.length) {
    return (
      <div className={cn('rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-md', className)}>
      <div className="rounded-[28px] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4ff_100%)] p-3 shadow-[0_16px_44px_rgba(15,23,42,0.10)]">
        <motion.div layout transition={springTransition} className="flex flex-col gap-2.5">
          {previewItems.map((item, index) => {
            const Icon = item.icon ?? CalendarDays;
            const collapsedScale = 1 - index * 0.025;

            const cardContent = (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: item.color ?? '#0f766e' }}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold leading-5 text-slate-800">{item.activity}</h3>
                    <p className="truncate text-xs text-slate-500">{item.location}</p>
                  </div>
                </div>
                <span className="justify-self-end whitespace-nowrap pt-0.5 text-right text-xs font-medium text-slate-500">{item.date}</span>
              </div>
            );

            return (
              <motion.div
                key={item.id}
                layout
                transition={springTransition}
                animate={{
                  marginTop: !isExpanded && index > 0 ? -collapsedOverlap : 0,
                  scale: !isExpanded ? collapsedScale : 1,
                  opacity: 1,
                }}
                className="min-h-[68px] rounded-[22px] border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.10)]"
                style={{
                  zIndex: previewItems.length - index,
                  transformOrigin: 'top center',
                  position: 'relative',
                }}
              >
                {item.href ? (
                  <Link href={item.href} className="block">
                    {cardContent}
                  </Link>
                ) : (
                  cardContent
                )}
              </motion.div>
            );
          })}

          <AnimatePresence initial={false}>
            {isExpanded &&
              items.slice(3).map((item) => {
                const Icon = item.icon ?? CalendarDays;

                const cardContent = (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: item.color ?? '#0f766e' }}
                      >
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold leading-5 text-slate-800">{item.activity}</h3>
                        <p className="truncate text-xs text-slate-500">{item.location}</p>
                      </div>
                    </div>
                    <span className="justify-self-end whitespace-nowrap pt-0.5 text-right text-xs font-medium text-slate-500">{item.date}</span>
                  </div>
                );

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={fadeTransition}
                    className="min-h-[68px] rounded-[22px] border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.10)]"
                  >
                    {item.href ? (
                      <Link href={item.href} className="block">
                        {cardContent}
                      </Link>
                    ) : (
                      cardContent
                    )}
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </motion.div>

        <div className={cn('flex justify-center', isExpanded ? 'mt-3' : 'mt-1.5')}>
          <button
            type="button"
            onClick={() => {
              const next = !isExpanded;
              if (expanded === undefined) {
                setInternalExpanded(next);
              }
              onExpandedChange?.(next);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {isExpanded ? 'Show Less' : `Show All${items.length > previewItems.length ? ` (${items.length})` : ''}`}
            <ChevronDown
              size={12}
              className={cn('transition-transform duration-300', isExpanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export default StackedActivityCards;
