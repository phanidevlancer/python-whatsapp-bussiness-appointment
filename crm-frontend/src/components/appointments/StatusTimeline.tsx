import { format } from 'date-fns';
import { Calendar, RotateCcw, XCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { AppointmentStatusHistory } from '@/types/appointment';
import { clsx } from 'clsx';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  confirmed: { color: 'bg-blue-500', icon: <CheckCircle size={14} />, label: 'Confirmed' },
  cancelled: { color: 'bg-red-500', icon: <XCircle size={14} />, label: 'Cancelled' },
  completed: { color: 'bg-green-500', icon: <CheckCircle size={14} />, label: 'Completed' },
  no_show: { color: 'bg-gray-400', icon: <AlertCircle size={14} />, label: 'No Show' },
  pending: { color: 'bg-amber-500', icon: <Clock size={14} />, label: 'Pending' },
};

export default function StatusTimeline({ history }: { history: AppointmentStatusHistory[] }) {
  if (!history.length) {
    return (
      <div className="text-center py-8">
        <Clock size={40} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No history available</p>
      </div>
    );
  }

  const getEventDescription = (entry: AppointmentStatusHistory) => {
    // Get source display name
    const getSourceName = (src: string | null) => {
      if (src === 'whatsapp') return 'WhatsApp';
      if (src === 'admin_dashboard') return 'Admin';
      return null;
    };

    // Check if this is a cancellation due to rescheduling
    const isRescheduleCancel = entry.new_status === 'cancelled' && 
                               entry.reason?.startsWith('Rescheduled to slot');

    // Handle reschedule events (the new appointment creation)
    if (entry.reschedule_source) {
      const rescheduleSource = getSourceName(entry.reschedule_source);
      return {
        title: 'Rescheduled',
        description: rescheduleSource ? `Rescheduled via ${rescheduleSource}` : 'Rescheduled',
        icon: <RotateCcw size={14} className="text-indigo-600" />,
        color: 'border-indigo-500',
      };
    }

    // Handle booking event (first entry with no old_status)
    if (!entry.old_status) {
      const bookingSource = getSourceName(entry.source);
      return {
        title: 'Booked',
        description: bookingSource ? `Appointment created via ${bookingSource}` : 'Appointment created',
        icon: <Calendar size={14} className="text-blue-600" />,
        color: 'border-blue-500',
      };
    }

    // Handle status changes with source
    const config = statusConfig[entry.new_status] || statusConfig.pending;
    const eventSource = getSourceName(entry.source);
    
    // Special handling for cancellation due to rescheduling
    if (isRescheduleCancel) {
      return {
        title: 'Rescheduled',
        description: 'Previous slot cancelled (rescheduled to new slot)',
        icon: <RotateCcw size={14} className="text-indigo-600" />,
        color: 'border-indigo-500',
      };
    }
    
    return {
      title: config.label,
      description: entry.reason || (eventSource ? `Status changed via ${eventSource}` : `Status changed to ${entry.new_status}`),
      icon: config.icon,
      color: config.color.replace('bg-', 'border-'),
    };
  };

  return (
    <div className="relative space-y-4">
      {history.map((entry, index) => {
        const event = getEventDescription(entry);
        const isLast = index === history.length - 1;

        return (
          <div key={entry.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[19px] top-8 bottom-0 w-px bg-gray-200" />
            )}

            {/* Icon */}
            <div className={clsx(
              'w-10 h-10 rounded-full shrink-0 flex items-center justify-center border-2 bg-white',
              event.color
            )}>
              {event.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                <span className="text-xs text-gray-400">
                  {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {event.description && (
                <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>
              )}
              {entry.reason && entry.reschedule_source && (
                <p className="text-xs text-gray-500 mt-1">Reason: {entry.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
