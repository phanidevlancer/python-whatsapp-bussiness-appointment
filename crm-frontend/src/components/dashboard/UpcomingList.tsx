import Link from 'next/link';
import { format } from 'date-fns';
import type { UpcomingAppointment } from '@/types/dashboard';
import StatusBadge from '@/components/appointments/StatusBadge';
import type { AppointmentStatus } from '@/types/appointment';

export default function UpcomingList({ items }: { items: UpcomingAppointment[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Appointments</h2>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No upcoming appointments</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((appt) => (
            <Link
              key={appt.id}
              href={`/appointments/${appt.id}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{appt.service_name}</p>
                <p className="text-xs text-gray-500">
                  {appt.user_phone}
                  {appt.provider_name && ` · ${appt.provider_name}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{format(new Date(appt.start_time), 'MMM d, h:mm a')}</p>
                <StatusBadge status={appt.status as AppointmentStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
