'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, ChevronDown, UserPen, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { StackedActivityCards } from '@/components/ui/stacked-activity-cards';
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

function getGroupCardItems(events: ActivityEvent[]) {
  return events.map((event) => ({
    id: `${event.created_at}-${event.event}`,
    activity: event.event,
    location: event.detail ?? (event.source === 'whatsapp' ? 'WhatsApp activity' : 'CRM activity'),
    date: format(new Date(event.created_at), 'MMM d'),
    href: event.appointment_id ? `/appointments/${event.appointment_id}` : undefined,
    color:
      event.type === 'appointment_event'
        ? '#3b82f6'
        : event.type === 'message_sent'
          ? '#14b8a6'
          : '#64748b',
  }));
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
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Activity Timeline</h3>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Loading activity…
        </div>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Activity Timeline</h3>
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
      <div
        className={`flex min-h-[68px] min-w-0 items-center rounded-[22px] border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.10)] transition-all duration-300 ease-out ${
          isAppointmentLink ? 'hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.16)]' : ''
        }`}
      >
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.dot} text-white shadow-sm`}>
              <Icon size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold leading-5 ${cfg.label}`}>{event.event}</p>
              {event.detail && (
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{event.detail}</p>
              )}
            </div>
          </div>
          <span className="justify-self-end whitespace-nowrap pt-0.5 text-right text-xs font-medium text-slate-500">
            {format(new Date(event.created_at), 'MMM d, h:mm a')}
          </span>
          <div className="col-span-1 flex flex-wrap items-center gap-1.5">
            {event.source && (
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {event.source === 'whatsapp' ? 'WhatsApp' : 'CRM'}
              </span>
            )}
            {showAppointmentRef && appointmentRef && (
              <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                Appointment ID: {appointmentRef}
              </span>
            )}
          </div>
          <div />
        </div>
      </div>
    );

    return (
      <div key={`${event.created_at}-${event.event}-${i}`} className="relative">
        {isAppointmentLink ? (
          <Link href={`/appointments/${event.appointment_id}`} className="block">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Activity Timeline</h3>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setView('flat')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              view === 'flat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Timeline View
          </button>
          <button
            type="button"
            onClick={() => setView('grouped')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              view === 'grouped' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Grouped View
          </button>
        </div>
      </div>
      <div className="relative">
        {view === 'flat' ? (
          <div className="space-y-3">
            {events.map((event, i) => renderEvent(event, i, true))}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEvents.map((group) => (
              <div key={group.key} className="space-y-3">
                {group.events.length > 1 ? (
                  <div className="rounded-[24px] bg-[linear-gradient(180deg,#fbfdff_0%,#eef4ff_100%)] p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                    <div className="mb-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                          {group.appointmentRef && (
                            <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              Booking ID: {group.appointmentRef}
                            </span>
                          )}
                          <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {getLastStatusLabel(group.events)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {group.events.length} events
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        aria-label={collapsedGroups[group.key] ? 'Expand group' : 'Collapse group'}
                      >
                        <ChevronDown size={12} className={`transition-transform ${collapsedGroups[group.key] ? '-rotate-90' : 'rotate-0'}`} />
                      </button>
                    </div>

                    <StackedActivityCards
                      items={getGroupCardItems(group.events)}
                      className="max-w-none"
                      expanded={collapsedGroups[group.key] === false}
                      onExpandedChange={(next) =>
                        setCollapsedGroups((prev) => ({ ...prev, [group.key]: !next }))
                      }
                    />
                  </div>
                ) : (
                  group.events.map((event, i) => renderEvent(event, i, false))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
