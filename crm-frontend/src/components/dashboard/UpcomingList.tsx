import Link from 'next/link';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { Clock, ChevronRight, Calendar } from 'lucide-react';
import type { UpcomingAppointment } from '@/types/dashboard';
import StatusBadge from '@/components/appointments/StatusBadge';
import type { AppointmentStatus } from '@/types/appointment';
import { Avatar } from '@/components/ui/Avatar';

interface UpcomingAppointmentExtended extends UpcomingAppointment {
  appointmentDate?: string; // Store the date for grouping
}

export default function UpcomingList({ items }: { items: UpcomingAppointmentExtended[] }) {
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const tomorrowEnd = endOfDay(tomorrow);

  console.log('UpcomingList - Total items:', items.length);
  console.log('UpcomingList - Today:', format(today, 'yyyy-MM-dd'));
  console.log('UpcomingList - Tomorrow:', format(tomorrow, 'yyyy-MM-dd'));
  
  // Filter appointments for today and tomorrow
  const todayAppointments = items.filter((appt) => {
    const apptDate = new Date(appt.start_time);
    const isToday = apptDate >= today && apptDate < tomorrow;
    if (isToday) {
      console.log('Today appt:', appt.service_name, format(apptDate, 'yyyy-MM-dd HH:mm'));
    }
    return isToday;
  });

  const tomorrowAppointments = items.filter((appt) => {
    const apptDate = new Date(appt.start_time);
    const isTomorrow = apptDate >= tomorrow && apptDate <= tomorrowEnd;
    if (isTomorrow) {
      console.log('Tomorrow appt:', appt.service_name, format(apptDate, 'yyyy-MM-dd HH:mm'));
    }
    return isTomorrow;
  });

  console.log('Today count:', todayAppointments.length);
  console.log('Tomorrow count:', tomorrowAppointments.length);

  // Sort by time
  const sortByTime = (a: UpcomingAppointmentExtended, b: UpcomingAppointmentExtended) => {
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calendar size={16} className="text-orange-600" />
          Upcoming Appointments
        </h3>
        <Link
          href="/appointments"
          className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
        >
          View all
          <ChevronRight size={14} />
        </Link>
      </div>
      
      {todayAppointments.length === 0 && tomorrowAppointments.length === 0 ? (
        <div className="text-center py-8">
          <Clock size={40} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No appointments for today or tomorrow</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Today's Appointments */}
          {todayAppointments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-orange-600" />
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Today ({format(today, 'MMM d')})
                </h4>
                <span className="text-xs text-gray-400">
                  {todayAppointments.length} {todayAppointments.length === 1 ? 'appt' : 'appts'}
                </span>
              </div>
              <div className="space-y-2">
                {todayAppointments.sort(sortByTime).map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/appointments/${appt.id}`}
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
                  >
                    <Avatar name={appt.user_phone} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {appt.service_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {appt.user_phone}
                        {appt.provider_name && ` • ${appt.provider_name}`}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {format(new Date(appt.start_time), 'h:mm a')}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={appt.status as AppointmentStatus} size="sm" />
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-gray-500 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tomorrow's Appointments */}
          {tomorrowAppointments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tomorrow ({format(tomorrow, 'MMM d')})
                </h4>
                <span className="text-xs text-gray-400">
                  {tomorrowAppointments.length} {tomorrowAppointments.length === 1 ? 'appt' : 'appts'}
                </span>
              </div>
              <div className="space-y-2">
                {tomorrowAppointments.sort(sortByTime).map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/appointments/${appt.id}`}
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
                  >
                    <Avatar name={appt.user_phone} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {appt.service_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {appt.user_phone}
                        {appt.provider_name && ` • ${appt.provider_name}`}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {format(new Date(appt.start_time), 'h:mm a')}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={appt.status as AppointmentStatus} size="sm" />
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-gray-500 transition-colors"
                      />
                    </div>
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
