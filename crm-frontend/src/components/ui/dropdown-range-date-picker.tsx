'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/Button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';

interface DropdownRangeDatePickerProps {
  value?: { from?: string; to?: string };
  onApply: (range: { from?: string; to?: string }) => void;
  className?: string;
}

function DropdownRangeDatePicker({
  value,
  onApply,
  className,
}: DropdownRangeDatePickerProps) {
  const today = React.useMemo(() => new Date(), []);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<DateRange | undefined>(
    value?.from
      ? {
          from: parseISO(value.from),
          to: value.to ? parseISO(value.to) : undefined,
        }
      : undefined
  );
  const [month, setMonth] = React.useState((selected?.from ?? today).getMonth());
  const [year, setYear] = React.useState((selected?.from ?? today).getFullYear());

  React.useEffect(() => {
    const nextSelected = value?.from
      ? {
          from: parseISO(value.from),
          to: value.to ? parseISO(value.to) : undefined,
        }
      : undefined;

    setSelected(nextSelected);
    const baseDate = nextSelected?.from ?? today;
    setMonth(baseDate.getMonth());
    setYear(baseDate.getFullYear());
  }, [value?.from, value?.to, today]);

  const displayMonth = new Date(year, month, 1);
  const yearOptions = Array.from({ length: 40 }, (_, i) => today.getFullYear() - 20 + i);

  const formattedValue = selected?.from
    ? selected.to
      ? `${format(selected.from, 'PPP')} - ${format(selected.to, 'PPP')}`
      : format(selected.from, 'PPP')
    : 'Pick a date range';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={className ?? 'w-[280px] justify-start text-left font-normal'}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate overflow-hidden">{formattedValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((optionYear) => (
                  <SelectItem key={optionYear} value={optionYear.toString()}>
                    {optionYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={month.toString()} onValueChange={(val) => setMonth(Number(val))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {format(new Date(2000, i, 1), 'MMMM')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Calendar
            mode="range"
            selected={selected}
            onSelect={setSelected}
            month={displayMonth}
            onMonthChange={(date) => {
              setMonth(date.getMonth());
              setYear(date.getFullYear());
            }}
            className="rounded-md border"
          />

          <div className="flex justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(undefined);
                onApply({});
                setOpen(false);
              }}
              disabled={!selected}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply({
                  from: selected?.from ? format(selected.from, 'yyyy-MM-dd') : undefined,
                  to: selected?.to ? format(selected.to, 'yyyy-MM-dd') : undefined,
                });
                setOpen(false);
              }}
              disabled={!selected?.from}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DropdownRangeDatePicker };
