'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View, Views, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isValid, parseISO } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAppointmentsList } from '@/hooks/useAppointments';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Calendar as CalendarIcon } from 'lucide-react';
import { enUS } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

// Setup date-fns localizer
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  status?: string;
  customerName?: string;
  serviceName?: string;
  phone?: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const { data, isLoading, error } = useAppointmentsList({ page_size: 100 });
  const [view, setView] = useState<View>(Views.WEEK);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Transform appointments to calendar events
  useEffect(() => {
    if (!data?.items || data.items.length === 0) {
      setEvents([]);
      return;
    }

    const mappedEvents: CalendarEvent[] = [];

    for (const appt of data.items) {
      // Skip cancelled appointments
      if (appt.status === 'cancelled') {
        continue;
      }

      if (!appt.slot || !appt.slot.start_time || !appt.slot.end_time) {
        continue;
      }

      const startDate = parseISO(appt.slot.start_time);
      const endDate = parseISO(appt.slot.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        continue;
      }

      mappedEvents.push({
        id: appt.id,
        title: `${appt.service?.name || 'Appt'} - ${appt.customer?.name || appt.user_phone}`,
        start: startDate,
        end: endDate,
        allDay: false,
        status: appt.status,
        customerName: appt.customer?.name || appt.user_phone,
        serviceName: appt.service?.name,
        phone: appt.user_phone,
      });
    }

    setEvents(mappedEvents);
  }, [data]);

  // Custom event style getter - Google Calendar colors
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const colors: Record<string, string> = {
      confirmed: '#188038',    // Green 700
      completed: '#1967d2',    // Blue 700
      pending: '#b06000',      // Amber 700
      no_show: '#5f6368',      // Gray 600
    };

    const backgroundColor = event.status ? colors[event.status] : '#5f6368';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        padding: '3px 6px',
        fontSize: '12px',
        fontWeight: '500',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        color: 'white',
        cursor: 'pointer',
        border: 'none',
      },
    };
  }, []);

  // Handle event click
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    router.push(`/appointments/${event.id}`);
  }, [router]);

  // Custom event component
  const EventComponent = useCallback(({ event }: { event: CalendarEvent }) => (
    <div className="flex flex-col leading-tight h-full justify-center overflow-hidden">
      <span className="font-medium truncate text-xs">
        {event.serviceName || 'Appointment'}
      </span>
      {event.customerName && (
        <span className="text-[10px] truncate opacity-95">
          {event.customerName.split(' ')[0]}
        </span>
      )}
    </div>
  ), []);

  // Custom toolbar - Google Calendar style
  const CustomToolbar = (toolbar: any) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');

    const getLabel = () => {
      if (Array.isArray(toolbar.label)) {
        return toolbar.label[0];
      }
      return toolbar.label;
    };

    const labelDate = getLabel();

    return (
      <div className="flex items-center justify-between mb-0 p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={goToBack} className="p-2 hover:bg-slate-100 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button onClick={goToNext} className="p-2 hover:bg-slate-100 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
          <h2 className="ml-2 text-xl font-semibold text-slate-900">
            {isValid(labelDate) ? format(labelDate, 'MMMM yyyy') : 'Calendar'}
          </h2>
        </div>
        <div className="flex gap-1">
          {([Views.DAY, Views.WEEK, Views.MONTH] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => toolbar.onView(v)}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                toolbar.view === v
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Get error message
  const getErrorMessage = () => {
    if (error) {
      const axiosError = error as any;
      if (axiosError?.response?.status === 422) {
        return 'Invalid request parameters';
      }
      if (axiosError?.response?.status === 401) {
        return 'Please login again';
      }
      return axiosError?.message || 'Unknown error';
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Calendar</h2>
          <p className="text-sm text-slate-500 mt-1">View and manage your appointments</p>
        </div>
        <Badge variant="primary" size="lg">
          <CalendarIcon size={18} />
          {events.length} Appointments
        </Badge>
      </div>

      {/* Calendar Card */}
      <Card className="p-0 overflow-hidden" variant="elevated">
        <style jsx global>{`
          .rbc-calendar {
            font-family: 'Roboto', 'Segoe UI', sans-serif;
            height: 800px;
          }
          
          .rbc-header {
            padding: 8px 4px;
            font-size: 11px;
            font-weight: 600;
            color: #5f6368;
            border-bottom: 1px solid #dadce0;
            text-transform: uppercase;
          }
          
          .rbc-header + .rbc-header {
            border-left: 1px solid #dadce0;
          }
          
          .rbc-header.rbc-today {
            background-color: #e8f0fe;
          }
          
          .rbc-date-cell {
            padding: 8px;
            text-align: right;
            font-size: 12px;
            font-weight: 500;
            color: #3c4043;
          }
          
          .rbc-date-cell.rbc-now {
            font-weight: 700;
            color: #1a73e8;
          }
          
          .rbc-day-bg {
            border-left: 1px solid #f1f3f4;
          }
          
          .rbc-day-bg + .rbc-day-bg {
            border-left: 1px solid #dadce0;
          }
          
          .rbc-today {
            background: #f8f9fa;
          }
          
          .rbc-event {
            border: none;
            border-radius: 4px;
            padding: 3px 6px;
            margin: 1px 4px;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }
          
          .rbc-event:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            z-index: 10;
            position: relative;
          }
          
          .rbc-toolbar {
            margin-bottom: 0;
            padding: 0;
          }
          
          .rbc-toolbar button {
            color: #5f6368;
            border-radius: 4px;
            font-size: 13px;
            padding: 8px 12px;
            transition: all 0.2s;
          }
          
          .rbc-toolbar button:hover {
            background: #f1f3f4;
          }
          
          .rbc-toolbar button.rbc-active {
            background: #1a73e8;
            color: white;
          }
          
          .rbc-toolbar button.rbc-active:hover {
            background: #1557b0;
          }
          
          .rbc-time-view {
            border: none;
          }
          
          .rbc-time-header {
            background: #f8f9fa;
            border-bottom: 1px solid #dadce0;
          }
          
          .rbc-time-slot {
            font-size: 10px;
            color: #5f6368;
          }
          
          .rbc-timeslot-group {
            border-bottom: 1px solid #f1f3f4;
          }
          
          .rbc-current-time-indicator {
            background: #ea4335;
            height: 2px;
          }
          
          .rbc-current-time-indicator::before {
            content: '';
            position: absolute;
            left: -6px;
            top: -5px;
            width: 10px;
            height: 10px;
            background: #ea4335;
            border-radius: 50%;
          }
          
          .rbc-time-gutter {
            background: #f8f9fa;
            border-right: 1px solid #dadce0;
          }
          
          .rbc-time-gutter .rbc-time-slot {
            text-align: right;
            padding-right: 8px;
          }
          
          .rbc-day-slot {
            background: white;
          }
          
          .rbc-event-label {
            color: rgba(255,255,255,0.95);
            font-size: 10px;
          }
          
          .rbc-event-title {
            color: white;
            font-size: 11px;
            font-weight: 500;
          }
          
          .rbc-show-more {
            font-size: 11px;
            color: #1a73e8;
            background: #e8f0fe;
            padding: 1px 4px;
            border-radius: 3px;
          }
          
          .rbc-month-row {
            border-bottom: 1px solid #dadce0;
          }
          
          .rbc-month-row:last-child {
            border-bottom: none;
          }
        `}</style>

        {isLoading ? (
          <div className="text-center py-16 text-slate-400">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-200 rounded-full mb-4"></div>
              <div className="w-40 h-5 bg-slate-200 rounded mb-2"></div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium mb-2">Error loading calendar</p>
            <p className="text-sm text-slate-500">{getErrorMessage()}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-sm font-medium text-slate-900 mb-1">No appointments</h3>
            <p className="text-sm text-slate-500">
              {data?.total ? `${data.total} appointments exist but may not have time slots` : 'Create an appointment'}
            </p>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={(newView) => setView(newView)}
            defaultView={Views.WEEK}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            step={30}
            timeslots={2}
            defaultDate={new Date()}
            min={new Date(0, 0, 0, 10, 0, 0)}
            max={new Date(0, 0, 0, 23, 0, 0)}
            showMultiDayTimes
            longPressThreshold={50}
            eventPropGetter={eventPropGetter}
            components={{
              toolbar: CustomToolbar,
              event: EventComponent,
            }}
            messages={{
              next: 'Next',
              previous: 'Previous',
              today: 'Today',
              month: 'Month',
              week: 'Week',
              day: 'Day',
              noEventsInRange: 'No appointments scheduled',
            }}
            onSelectEvent={handleSelectEvent}
            selectable
            popup
          />
        )}
      </Card>
    </div>
  );
}
