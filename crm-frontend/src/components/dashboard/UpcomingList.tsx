import Link from 'next/link';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { CalendarDays, ChevronRight, Clock } from 'lucide-react';
import type { UpcomingAppointment } from '@/types/dashboard';

function getPhonePrefix(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 2) || phone.slice(0, 2).toUpperCase();
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'text-green-600 bg-green-50';
  if (s === 'completed') return 'text-teal-600 bg-teal-50';
  if (s === 'cancelled') return 'text-red-600 bg-red-50';
  if (s === 'no_show' || s === 'no-show') return 'text-orange-600 bg-orange-50';
  return 'text-[color:var(--text-secondary)] dashboard-surface-muted';
}

function statusDotClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'bg-green-600';
  if (s === 'completed') return 'bg-teal-600';
  if (s === 'cancelled') return 'bg-red-600';
  if (s === 'no_show' || s === 'no-show') return 'bg-orange-600';
  return 'bg-[color:var(--text-secondary)]';
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' ');
}

interface UpcomingAppointmentExtended extends UpcomingAppointment {
  appointmentDate?: string;
}

export default function UpcomingList({ items }: { items: UpcomingAppointmentExtended[] }) {
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const tomorrowEnd = endOfDay(tomorrow);

  const todayAppointments = items
    .filter((appt) => {
      const d = new Date(appt.start_time);
      return d >= today && d < tomorrow;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const tomorrowAppointments = items
    .filter((appt) => {
      const d = new Date(appt.start_time);
      return d >= tomorrow && d <= tomorrowEnd;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <div className="dashboard-page-panel flex flex-col rounded-2xl p-4">
      {/* Header — matches reference exactly */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="flex items-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <CalendarDays size={15} className="mr-2" style={{ color: 'var(--text-secondary)' }} />
          Upcoming Appointments
        </h3>
        <Link
          href="/appointments"
          className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-0.5"
        >
          View all <ChevronRight size={10} />
        </Link>
      </div>

      {todayAppointments.length === 0 && tomorrowAppointments.length === 0 ? (
        <div className="text-center py-8">
          <Clock size={40} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No appointments for today or tomorrow</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {/* Today */}
          {todayAppointments.length > 0 && (
            <div>
              {/* Date group header — exact reference style */}
              <div className="mb-3 flex items-center text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 shrink-0" />
                TODAY ({format(today, 'MMM d').toUpperCase()})
                <span className="ml-1 font-normal" style={{ color: 'var(--text-tertiary)' }}>{todayAppointments.length} appts</span>
              </div>
              <div className="space-y-3">
                {todayAppointments.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/appointments/${appt.id}`}
                    className="dashboard-surface-strong group flex items-center justify-between rounded-xl p-3 shadow-sm transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center mr-3 shrink-0">
                        {getPhonePrefix(appt.user_phone)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold leading-tight transition-colors group-hover:text-blue-600" style={{ color: 'var(--text-primary)' }}>
                          {appt.service_name}
                        </h4>
                        <p className="mt-0.5 text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{appt.user_phone}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(appt.start_time), 'h:mm a')}
                      </p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadgeClass(appt.status)}`}>
                        <span className={`w-1 h-1 rounded-full mr-1 shrink-0 ${statusDotClass(appt.status)}`} />
                        {statusLabel(appt.status)}
                      </span>
                    </div>
                    <ChevronRight size={12} className="ml-2 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tomorrow */}
          {tomorrowAppointments.length > 0 && (
            <div>
              <div className="mb-3 flex items-center text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 shrink-0" />
                TOMORROW ({format(tomorrow, 'MMM d').toUpperCase()})
                <span className="ml-1 font-normal" style={{ color: 'var(--text-tertiary)' }}>{tomorrowAppointments.length} appts</span>
              </div>
              <div className="space-y-3">
                {tomorrowAppointments.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/appointments/${appt.id}`}
                    className="dashboard-surface-strong group flex items-center justify-between rounded-xl p-3 shadow-sm transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center mr-3 shrink-0">
                        {getPhonePrefix(appt.user_phone)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold leading-tight transition-colors group-hover:text-blue-600" style={{ color: 'var(--text-primary)' }}>
                          {appt.service_name}
                        </h4>
                        <p className="mt-0.5 text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{appt.user_phone}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {format(new Date(appt.start_time), 'h:mm a')}
                      </p>
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadgeClass(appt.status)}`}>
                        <span className={`w-1 h-1 rounded-full mr-1 shrink-0 ${statusDotClass(appt.status)}`} />
                        {statusLabel(appt.status)}
                      </span>
                    </div>
                    <ChevronRight size={12} className="ml-2 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
