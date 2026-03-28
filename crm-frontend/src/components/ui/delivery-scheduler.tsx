'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export interface DeliverySchedulerTimeSlot {
  label: string;
  value: string;
  disabled?: boolean;
}

interface DeliverySchedulerProps {
  initialDate?: Date;
  timeSlots: Array<string | DeliverySchedulerTimeSlot>;
  timeZone: string;
  onSchedule: (dateTime: { date: Date; time: string }) => void;
  onDateChange?: (date: Date) => void;
  onTimeChange?: (time: string) => void;
  selectedTime?: string | null;
  minDate?: Date;
  onCancel?: () => void;
  className?: string;
  scheduleLabel?: string;
  cancelLabel?: string;
  scheduleDisabled?: boolean;
}

const scheduleButtonVariants = cva(
  'relative isolate inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-transparent text-slate-700 hover:bg-slate-100',
        selected: 'text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = [];
  const startOfWeek = new Date(startDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  for (let i = 0; i < 6; i++) {
    const nextDay = new Date(startOfWeek);
    nextDay.setDate(startOfWeek.getDate() + i);
    days.push(nextDay);
  }

  return days;
};

const normalizeDate = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const isSameDay = (left: Date, right: Date) => normalizeDate(left).getTime() === normalizeDate(right).getTime();

const normalizeTimeSlot = (slot: string | DeliverySchedulerTimeSlot): DeliverySchedulerTimeSlot =>
  typeof slot === 'string' ? { label: slot, value: slot } : slot;

export function DeliveryScheduler({
  initialDate = new Date(),
  timeSlots,
  timeZone,
  onSchedule,
  onDateChange,
  onTimeChange,
  selectedTime,
  minDate,
  onCancel,
  className,
  scheduleLabel = 'Schedule',
  cancelLabel = 'Cancel',
  scheduleDisabled = false,
}: DeliverySchedulerProps) {
  const normalizedInitialDate = normalizeDate(initialDate);
  const minimumDate = minDate ? normalizeDate(minDate) : null;
  const defaultTimeSlot = timeSlots[0] ? normalizeTimeSlot(timeSlots[0]).value : null;

  const [currentDate, setCurrentDate] = useState(normalizedInitialDate);
  const [selectedDate, setSelectedDate] = useState<Date>(normalizedInitialDate);
  const [internalSelectedTime, setInternalSelectedTime] = useState<string | null>(selectedTime ?? defaultTimeSlot);

  const activeTime = selectedTime ?? internalSelectedTime;
  const weekDays = getWeekDays(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const normalizedSlots = useMemo(() => timeSlots.map(normalizeTimeSlot), [timeSlots]);

  const handleDateSelect = (date: Date) => {
    if (minimumDate && normalizeDate(date) < minimumDate) return;
    setSelectedDate(date);
    onDateChange?.(date);
  };

  const handleTimeSelect = (time: string) => {
    if (selectedTime === undefined) {
      setInternalSelectedTime(time);
    }
    onTimeChange?.(time);
  };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    if (minimumDate && direction === 'prev' && normalizeDate(newDate) < minimumDate) {
      newDate.setTime(minimumDate.getTime());
    }
    setCurrentDate(newDate);
  };

  const handleSchedule = () => {
    if (selectedDate && activeTime) {
      onSchedule({ date: selectedDate, time: activeTime });
    }
  };

  const canGoPrev = !minimumDate || weekDays.some((day) => normalizeDate(day) > minimumDate);

  return (
    <div className={cn('w-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm', className)}>
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-slate-500">Delivery Window*</label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{monthYear}</h3>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => changeWeek('prev')}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canGoPrev}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => changeWeek('next')}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Next week"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {weekDays.map((day) => {
            const isSelected = isSameDay(selectedDate, day);
            const isDisabled = minimumDate ? normalizeDate(day) < minimumDate : false;

            return (
              <div key={day.toISOString()} className="relative flex flex-col items-center">
                <span className="mb-2 text-xs text-slate-500">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  className={cn(scheduleButtonVariants({ variant: isSelected ? 'selected' : 'default' }), 'h-10 w-10')}
                >
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        layoutId="date-selector"
                        className="absolute inset-0 z-0 rounded-lg bg-primary-600"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      />
                    )}
                  </AnimatePresence>
                  <span className="relative z-10">{day.getDate()}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">{timeZone}</p>
          {normalizedSlots.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {normalizedSlots.map((timeSlot) => {
                const isSelected = activeTime === timeSlot.value;
                return (
                  <button
                    key={timeSlot.value}
                    type="button"
                    onClick={() => handleTimeSelect(timeSlot.value)}
                    disabled={timeSlot.disabled}
                    className={cn(scheduleButtonVariants({ variant: isSelected ? 'selected' : 'default' }))}
                  >
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          layoutId="time-selector"
                          className="absolute inset-0 z-0 rounded-lg bg-primary-600"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        />
                      )}
                    </AnimatePresence>
                    <span className="relative z-10">{timeSlot.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No time slots available for the selected day.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 border-t border-slate-200 pt-4">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className={cn(scheduleButtonVariants({ variant: 'default' }), 'border border-slate-200 bg-slate-100 px-6')}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSchedule}
            disabled={!activeTime || scheduleDisabled}
            className={cn(scheduleButtonVariants({ variant: 'selected' }), 'bg-primary-600 px-6')}
          >
            {scheduleLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
