'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: 'relative flex flex-col gap-4 sm:flex-row',
    month: 'w-full',
    month_caption: 'relative z-20 mx-10 mb-1 flex h-9 items-center justify-center',
    caption_label: 'text-sm font-medium',
    nav: 'absolute top-0 z-10 flex w-full justify-between',
    button_previous: cn(
      buttonVariants({ variant: 'ghost' }),
      'size-9 p-0 text-muted-foreground/80 hover:text-foreground'
    ),
    button_next: cn(
      buttonVariants({ variant: 'ghost' }),
      'size-9 p-0 text-muted-foreground/80 hover:text-foreground'
    ),
    weekday: 'size-9 p-0 text-xs font-medium text-muted-foreground/80',
    selected: 'rdp-day-selected',
    day_button:
      'rdp-day-button relative z-10 flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-foreground outline-offset-2 transition-[color,background-color,border-radius,box-shadow] duration-150 hover:bg-accent hover:text-foreground focus:outline-none focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:text-foreground/30 disabled:line-through',
    day: 'rdp-day-cell size-9 p-0 text-sm text-center',
    range_start: 'rdp-range-start',
    range_end: 'rdp-range-end',
    range_middle: 'rdp-range-middle',
    outside: 'rdp-day-outside text-muted-foreground',
    today:
      'rdp-day-today',
    hidden: 'invisible',
    week_number: 'size-9 p-0 text-xs font-medium text-muted-foreground/80',
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames]
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames
  );

  const defaultComponents = {
    Chevron: (props: React.SVGProps<SVGSVGElement> & { orientation?: 'left' | 'right' }) => {
      if (props.orientation === 'left') {
        return <ChevronLeft size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      return <ChevronRight size={16} strokeWidth={2} {...props} aria-hidden="true" />;
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('w-fit', className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
