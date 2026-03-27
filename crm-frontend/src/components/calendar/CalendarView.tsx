'use client';

import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { Appointment } from '@/types/appointment';
import { STATUS_COLORS } from '@/components/appointments/StatusBadge';

interface CalendarViewProps {
  appointments: Appointment[];
  initialView?: 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay';
  onViewChange?: (view: 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay') => void;
}

export default function CalendarView({
  appointments,
  initialView = 'timeGridWeek',
  onViewChange,
}: CalendarViewProps) {
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
    <div className="calendar-container">
      <style jsx global>{`
        .calendar-container {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        /* Premium Calendar Styling */
        .fc {
          font-size: 13px;
        }
        
        .fc-toolbar {
          margin-bottom: 16px !important;
        }
        
        .fc-toolbar-title {
          font-size: 18px !important;
          font-weight: 600;
          color: #111827;
        }
        
        .fc-button {
          border: 1px solid #e5e7eb !important;
          background: white !important;
          color: #374151 !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
          text-transform: capitalize !important;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
          transition: all 0.2s !important;
        }
        
        .fc-button:hover {
          background: #f9fafb !important;
          border-color: #d1d5db !important;
          box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1) !important;
        }
        
        .fc-button-active {
          background: #2563eb !important;
          border-color: #2563eb !important;
          color: white !important;
        }
        
        .fc-col-header-cell {
          background: #f9fafb !important;
          border-color: #e5e7eb !important;
          padding: 12px 0 !important;
          font-weight: 600 !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
        }
        
        .fc-daygrid-day {
          border-color: #e5e7eb !important;
        }
        
        .fc-daygrid-day-number {
          color: #374151 !important;
          font-weight: 500 !important;
          padding: 8px !important;
        }
        
        .fc-day-today {
          background: #eff6ff !important;
        }
        
        .fc-timegrid-slot {
          border-color: #f3f4f6 !important;
        }
        
        .fc-timegrid-slot-label {
          color: #6b7280 !important;
          font-size: 11px !important;
        }
        
        .fc-event {
          border: none !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1) !important;
          cursor: pointer !important;
          transition: transform 0.15s !important;
        }
        
        .fc-event:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
        }
        
        .fc-event-title {
          font-weight: 500 !important;
        }
        
        .fc-popover {
          border: 1px solid #e5e7eb !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }
        
        .fc-popover-header {
          background: #f9fafb !important;
          border-bottom: 1px solid #e5e7eb !important;
          padding: 12px 16px !important;
          border-radius: 12px 12px 0 0 !important;
        }
        
        .fc-popover-title {
          font-weight: 600 !important;
          color: #111827 !important;
        }
        
        .fc-list-event {
          border-color: transparent !important;
        }
        
        .fc-list-event:hover td {
          background: #f9fafb !important;
        }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
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
        allDaySlot={false}
        nowIndicator={true}
        dayMaxEvents={3}
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
      />
    </div>
  );
}
