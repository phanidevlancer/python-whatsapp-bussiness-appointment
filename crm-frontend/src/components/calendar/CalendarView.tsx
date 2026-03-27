'use client';

import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { Appointment } from '@/types/appointment';
import { STATUS_COLORS } from '@/components/appointments/StatusBadge';

export default function CalendarView({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter();

  const events = appointments
    .filter((a) => a.slot)
    .map((a) => ({
      id: a.id,
      title: `${a.service?.name ?? 'Appt'} – ${a.customer?.name ?? a.user_phone}`,
      start: a.slot!.start_time,
      end: a.slot!.end_time,
      color: STATUS_COLORS[a.status] ?? '#6b7280',
      extendedProps: { appointmentId: a.id },
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        eventClick={(info) => {
          router.push(`/appointments/${info.event.extendedProps.appointmentId}`);
        }}
        height="auto"
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
      />
    </div>
  );
}
