'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, ChevronDown, UserPen, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ActivityEvent } from '@/types/lead';

interface Props {
  events: ActivityEvent[];
  isLoading: boolean;
}

const TYPE_CONFIG = {
  appointment_event: {
    icon: CalendarCheck,
    dot: 'bg-blue-500',
    label: 'text-blue-600',
    line: 'bg-blue-100',
  },
  profile_change: {
    icon: UserPen,
    dot: 'bg-slate-400',
    label: 'text-slate-600',
    line: 'bg-slate-100',
  },
  message_sent: {
    icon: MessageSquare,
    dot: 'bg-teal-500',
    label: 'text-teal-600',
    line: 'bg-teal-50',
  },
} as const;

type TimelineView = 'flat' | 'grouped';

function getAppointmentRef(appointmentId: string | null) {
  return appointmentId ? appointmentId.split('-')[0].toUpperCase() : null;
}

function getLastStatusLabel(events: ActivityEvent[]) {
  const latestAppointmentEvent = events.find((event) => event.type === 'appointment_event');
  return latestAppointmentEvent?.event ?? 'General activity';
}

export default function ActivityTimeline({ events, isLoading }: Props) {
  const [view, setView] = useState<TimelineView>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; appointmentRef: string | null; events: ActivityEvent[] }>();

    events.forEach((event) => {
      const appointmentRef = getAppointmentRef(event.appointment_id);
      const key = event.appointment_id ?? 'general';
      const title = appointmentRef ? `Appointment ${appointmentRef}` : 'General';

      if (!groups.has(key)) {
        groups.set(key, { key, title, appointmentRef, events: [] });
      }

      groups.get(key)?.events.push(event);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aTime = a.events[0] ? new Date(a.events[0].created_at).getTime() : 0;
      const bTime = b.events[0] ? new Date(b.events[0].created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [events]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Activity Timeline</h3>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Loading activity…
        </div>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Activity Timeline</h3>
        <p className="text-sm text-slate-400">No activity recorded yet.</p>
      </div>
    );
  }

  const renderEvent = (event: ActivityEvent, i: number, showAppointmentRef = true) => {
    const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.profile_change;
    const Icon = cfg.icon;
    const appointmentRef = getAppointmentRef(event.appointment_id);
    const isAppointmentLink = !!event.appointment_id;
    const content = (
      <div className={`flex-1 min-w-0 pb-1 ${isAppointmentLink ? 'rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors hover:bg-slate-50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium ${cfg.label}`}>{event.event}</p>
          <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
            {format(new Date(event.created_at), 'MMM d, h:mm a')}
          </span>
        </div>
        {event.detail && (
          <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {event.source && (
            <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {event.source === 'whatsapp' ? 'WhatsApp' : 'CRM'}
            </span>
          )}
          {showAppointmentRef && appointmentRef && (
            <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
              Appointment ID: {appointmentRef}
            </span>
          )}
        </div>
      </div>
    );

    return (
      <div key={`${event.created_at}-${event.event}-${i}`} className="flex gap-4 relative">
        <div className={`w-6 h-6 rounded-full ${cfg.dot} flex items-center justify-center shrink-0 z-10 mt-0.5 ring-2 ring-white`}>
          <Icon size={12} className="text-white" />
        </div>

        {isAppointmentLink ? (
          <Link href={`/appointments/${event.appointment_id}`} className="flex-1 min-w-0">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Activity Timeline</h3>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setView('flat')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'flat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Timeline View
          </button>
          <button
            type="button"
            onClick={() => setView('grouped')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'grouped' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Grouped View
          </button>
        </div>
      </div>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-100" />

        {view === 'flat' ? (
          <div className="space-y-5">
            {events.map((event, i) => renderEvent(event, i, true))}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedEvents.map((group) => (
              <div key={group.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                      {group.appointmentRef && (
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          Booking ID: {group.appointmentRef}
                        </span>
                      )}
                      <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {getLastStatusLabel(group.events)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {group.events.length} event{group.events.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${collapsedGroups[group.key] ? '-rotate-90' : 'rotate-0'}`}
                  />
                </button>

                {!collapsedGroups[group.key] && (
                  <div className="mt-4 space-y-5">
                    {group.events.map((event, i) => renderEvent(event, i, false))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
