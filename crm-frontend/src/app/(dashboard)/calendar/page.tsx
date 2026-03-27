'use client';

import { useAppointmentsList } from '@/hooks/useAppointments';
import CalendarView from '@/components/calendar/CalendarView';

export default function CalendarPage() {
  const { data, isLoading } = useAppointmentsList({ page_size: 200 });

  if (isLoading) return <div className="text-gray-400 text-sm text-center p-8">Loading…</div>;

  return <CalendarView appointments={data?.items ?? []} />;
}
